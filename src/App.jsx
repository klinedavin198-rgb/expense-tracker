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
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function ExpenseTracker() {
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("ទូទៅ");

  const [currency, setCurrency] = useState("USD");
  const [editingId, setEditingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const [timeframe, setTimeframe] = useState("month");

  // State ថ្មីសម្រាប់ផ្ទុក ខែ និងឆ្នាំ ដែលបានជ្រើសរើស (លំនាំដើមគឺខែបច្ចុប្បន្ន)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    // បង្កើតទម្រង់ "YYYY-MM" (ឧ. "2026-08")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const EXCHANGE_RATE = 4000;
  const COLORS = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
  ];

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

    const numAmount = parseFloat(amount);
    const finalAmountUSD =
      currency === "KHR" ? numAmount / EXCHANGE_RATE : numAmount;

    try {
      if (editingId) {
        const transactionRef = doc(db, "transactions", editingId);
        await updateDoc(transactionRef, {
          text: text,
          amount: finalAmountUSD,
          originalAmount: numAmount,
          currency: currency,
          type: type,
          category: category,
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, "transactions"), {
          text: text,
          amount: finalAmountUSD,
          originalAmount: numAmount,
          currency: currency,
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
    setAmount(
      transaction.originalAmount
        ? transaction.originalAmount.toString()
        : transaction.amount.toString(),
    );
    setCurrency(transaction.currency || "USD");
    setType(transaction.type);
    setCategory(transaction.category);
    setEditingId(transaction.id);
    setShowHistory(true);
  };

  const deleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
    } catch (error) {
      console.error("មានបញ្ហាក្នុងការលុបទិន្នន័យ: ", error);
    }
  };

  // --- ការច្រោះទិន្នន័យ (Filter) ---
  const currentDate = new Date();

  const filteredTransactions = transactions.filter((t) => {
    if (timeframe === "all") return true;

    const tDate = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);

    if (timeframe === "month") {
      // បំបែក "2026-08" ទៅជាឆ្នាំនិងខែដាច់ដោយឡែក
      const [year, month] = selectedMonth.split("-");
      // ប្រៀបធៀបជាមួយឆ្នាំនិងខែរបស់ទិន្នន័យ (month - 1 ព្រោះ Date ក្នុង JS រាប់ខែពី 0)
      return (
        tDate.getFullYear() === parseInt(year) &&
        tDate.getMonth() === parseInt(month) - 1
      );
    }
    if (timeframe === "year") {
      return tDate.getFullYear() === currentDate.getFullYear();
    }
    return true;
  });

  // --- ការគណនាសមតុល្យ ---
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

  // --- រៀបចំទិន្នន័យសម្រាប់ Pie Chart ---
  const expensesByCategory = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
      return acc;
    }, {});

  const pieData = Object.keys(expensesByCategory).map((key) => ({
    name: key,
    value: expensesByCategory[key],
  }));

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-6 tracking-tight">
          បញ្ជីចំណូលចំណាយ
        </h1>

        {/* របារជម្រើសពេលវេលា (Tabs) */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-2 shadow-inner">
          <button
            onClick={() => setTimeframe("month")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "month" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ប្រចាំខែ
          </button>
          <button
            onClick={() => setTimeframe("year")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "year" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ឆ្នាំនេះ
          </button>
          <button
            onClick={() => setTimeframe("all")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "all" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            សរុបទាំងអស់
          </button>
        </div>

        {/* ប្រអប់រើសខែ (លេចចេញតែពេលជ្រើសរើស Tab "ប្រចាំខែ" ប៉ុណ្ណោះ) */}
        {timeframe === "month" && (
          <div className="flex justify-center mb-6 mt-3 relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border-2 border-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm hover:shadow"
            />
          </div>
        )}

        {/* បង្កើតគម្លាតបន្តិចបើមិនបានរើស Tab ខែ */}
        {timeframe !== "month" && <div className="mb-6"></div>}

        {/* ផ្ទាំងបង្ហាញសមតុល្យ */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl mb-6 shadow-md">
          <p className="text-sm font-medium opacity-90 text-center">
            {timeframe === "month"
              ? "សមតុល្យប្រចាំខែ"
              : timeframe === "year"
                ? "សមតុល្យឆ្នាំនេះ"
                : "សមតុល្យសរុប"}
          </p>
          <div className="text-center my-2">
            <h2 className="text-4xl font-black">${balance.toFixed(2)}</h2>
            <p className="text-lg font-bold text-blue-200 mt-1">
              ≈ {(balance * EXCHANGE_RATE).toLocaleString("km-KH")} ៛
            </p>
          </div>

          <div className="flex justify-between mt-6 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
            <div className="text-center w-1/2 border-r border-white/20">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                ចំណូល
              </p>
              <p className="font-bold text-green-400 text-lg">
                +${totalIncome.toFixed(2)}
              </p>
            </div>
            <div className="text-center w-1/2">
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                ចំណាយ
              </p>
              <p className="font-bold text-red-400 text-lg">
                -${totalExpense.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* ក្រាប Pie Chart */}
        {pieData.length > 0 && (
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <h3 className="text-center text-sm font-bold text-slate-600 mb-2">
              ក្រាបចំណាយតាមប្រភេទ
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ហ្វមបញ្ចូលទិន្នន័យ */}
        <form
          onSubmit={handleSubmit}
          className={`mb-4 p-4 rounded-2xl border transition-all ${editingId ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100"}`}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
              {editingId ? "កំពុងកែប្រែ..." : "បញ្ចូលប្រតិបត្តិការថ្មី"}
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
              placeholder="ការពិពណ៌នា..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <div className="flex w-1/2 bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
                <input
                  type="number"
                  step="any"
                  placeholder="ទឹកប្រាក់"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-3 focus:outline-none"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-slate-50 border-l border-slate-200 px-2 font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="USD">$</option>
                  <option value="KHR">៛</option>
                </select>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
              className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="expense">📉 ចំណាយ (Expense)</option>
              <option value="income">📈 ចំណូល (Income)</option>
            </select>
            <button
              type="submit"
              className={`w-full text-white font-bold p-3 rounded-xl transition-all shadow-md ${editingId ? "bg-emerald-500 hover:bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {editingId ? "រក្សាទុកការកែប្រែ" : "បញ្ចូលទិន្នន័យ"}
            </button>
          </div>
        </form>

        {/* ផ្ទាំងប្រវត្តិ */}
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 mb-2"
        >
          {showHistory
            ? "លាក់ប្រវត្តិប្រតិបត្តិការ 🔼"
            : "មើលប្រវត្តិប្រតិបត្តិការ 🔽"}
        </button>

        {showHistory && (
          <div className="mt-4 transition-all duration-300">
            <div className="flex justify-between items-end mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                ប្រវត្តិប្រតិបត្តិការ
              </h3>
              <span className="text-xs font-semibold bg-slate-200 text-slate-600 py-1 px-2 rounded-lg">
                {filteredTransactions.length} ធាតុ
              </span>
            </div>
            <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-slate-500 text-sm">
                    មិនមានប្រវត្តិប្រតិបត្តិការក្នុងចន្លោះពេលនេះទេ...
                  </p>
                </div>
              ) : (
                filteredTransactions.map((t) => (
                  <li
                    key={t.id}
                    className="group flex justify-between items-center p-4 rounded-xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden bg-white border-slate-100"
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
                        {t.type === "income" ? "+" : "-"}
                        {t.currency === "KHR"
                          ? `${(t.originalAmount || 0).toLocaleString("km-KH")} ៛`
                          : `$${(t.amount || 0).toFixed(2)}`}
                      </span>
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-400 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
