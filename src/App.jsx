import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

export default function ExpenseTracker() {
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("ទូទៅ");
  const [editingId, setEditingId] = useState(null);

  // បន្ថែម State សម្រាប់គ្រប់គ្រងការបង្ហាញ/លាក់ប្រវត្តិ
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "transactions"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text || !amount)
      return alert("សូមបញ្ជូលការពិពណ៌នា និងចំនួនទឹកប្រាក់!");

    try {
      if (editingId) {
        const transactionRef = doc(db, "transactions", editingId);
        await updateDoc(transactionRef, {
          text: text,
          amount: parseFloat(amount),
          type: type,
          category: category,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "transactions"), {
          text: text,
          amount: parseFloat(amount),
          type: type,
          category: category,
          date: new Date().toLocaleDateString("km-KH"),
          createdAt: new Date(),
        });
      }

      setText("");
      setAmount("");
    } catch (error) {
      console.error("មានបញ្ហាក្នុងការបញ្ជូនទិន្នន័យ: ", error);
      alert(
        "មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ Firebase សូមពិនិត្យមើលអ៊ីនធឺណិតរបស់អ្នក។",
      );
    }
  };

  const handleEdit = (transaction) => {
    setText(transaction.text);
    setAmount(transaction.amount.toString());
    setType(transaction.type);
    setCategory(transaction.category);
    setEditingId(transaction.id);
    // នៅពេលចុចកែប្រែ យើងឱ្យវាបើកផ្ទាំងប្រវត្តិដោយស្វ័យប្រវត្តិ
    setShowHistory(true);
  };

  const deleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
    } catch (error) {
      console.error("មានបញ្ហាក្នុងការលុបទិន្នន័យ: ", error);
    }
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const balance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-6 tracking-tight">
          បញ្ជីចំណូលចំណាយ
        </h1>

        {/* ផ្ទាំងបង្ហាញសមតុល្យ */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl mb-8 shadow-md">
          <p className="text-sm font-medium opacity-90 text-center">
            សមតុល្យសរុបបច្ចុប្បន្ន
          </p>
          <h2 className="text-4xl font-black text-center my-2">
            ${balance.toFixed(2)}
          </h2>
          <div className="flex justify-between mt-6 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
            <div className="text-center w-1/2 border-r border-white/20">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                ចំណូលសរុប
              </p>
              <p className="font-bold text-green-400 text-lg">
                +${totalIncome.toFixed(2)}
              </p>
            </div>
            <div className="text-center w-1/2">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                ចំណាយសរុប
              </p>
              <p className="font-bold text-red-400 text-lg">
                -${totalExpense.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* ហ្វមបញ្ចូល ឬកែប្រែទិន្នន័យ */}
        <form
          onSubmit={handleSubmit}
          className={`mb-4 p-4 rounded-2xl border transition-all ${editingId ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100"}`}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              {editingId
                ? "កំពុងកែប្រែប្រតិបត្តិការ..."
                : "បញ្ចូលប្រតិបត្តិការថ្មី"}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setText("");
                  setAmount("");
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-200 px-2 py-1 rounded"
              >
                បោះបង់
              </button>
            )}
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="ការពិពណ៌នា (ឧ. ញ៉ាំកាហ្វេ, បើកប្រាក់ខែ...)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="ទឹកប្រាក់ ($)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="ទូទៅ">ទូទៅ</option>
                <option value="ម្ហូបអាហារ">ម្ហូបអាហារ</option>
                <option value="ធ្វើដំណើរ">ធ្វើដំណើរ</option>
                <option value="ប្រាក់ខែ">ប្រាក់ខែ</option>
                <option value="ទិញឥវ៉ាន់">ទិញឥវ៉ាន់</option>
              </select>
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer font-medium"
            >
              <option value="expense">📉 ចំណាយ (Expense)</option>
              <option value="income">📈 ចំណូល (Income)</option>
            </select>
            <button
              type="submit"
              className={`w-full text-white font-bold p-3 rounded-xl active:scale-[0.98] transition-all shadow-md ${editingId ? "bg-emerald-500 hover:bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {editingId ? "រក្សាទុកការកែប្រែ" : "បញ្ចូលទិន្នន័យ"}
            </button>
          </div>
        </form>

        {/* ប៊ូតុងសម្រាប់ បង្ហាញ/លាក់ ប្រវត្តិ */}
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 mb-2"
        >
          {showHistory
            ? "លាក់ប្រវត្តិប្រតិបត្តិការ 🔼"
            : "មើលប្រវត្តិប្រតិបត្តិការ 🔽"}
        </button>

        {/* ផ្ទាំងប្រវត្តិ (បង្ហាញតែពេល showHistory ជា true ប៉ុណ្ណោះ) */}
        {showHistory && (
          <div className="mt-4 transition-all duration-300">
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                ប្រវត្តិប្រតិបត្តិការ
              </h3>
              <span className="text-xs font-semibold bg-slate-200 text-slate-600 py-1 px-2 rounded-lg">
                {transactions.length} ធាតុ
              </span>
            </div>

            <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {transactions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-slate-500 text-sm">
                    កំពុងផ្ទុកទិន្នន័យ ឬមិនទាន់មានប្រវត្តិ...
                  </p>
                </div>
              ) : (
                transactions.map((t) => (
                  <li
                    key={t.id}
                    className={`group flex justify-between items-center p-4 rounded-xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden ${editingId === t.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100"}`}
                  >
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1.5 ${t.type === "income" ? "bg-green-500" : "bg-red-500"}`}
                    ></div>

                    <div className="flex flex-col pl-3">
                      <span className="text-slate-800 font-bold text-md">
                        {t.text}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-0.5">
                        {t.date} •{" "}
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {t.category}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`font-black text-lg mr-2 ${t.type === "income" ? "text-green-500" : "text-red-500"}`}
                      >
                        {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
                      </span>

                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-400 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="កែប្រែ"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="លុបចោល"
                      >
                        ❌
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
