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
import * as XLSX from "xlsx";

export default function ExpenseTracker() {
  const [transactions, setTransactions] = useState([]);
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("ទូទៅ");

  const [dateInput, setDateInput] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currency, setCurrency] = useState("USD");
  const [editingId, setEditingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // ប្តូរលំនាំដើមទៅជា 'custom' (ចន្លោះថ្ងៃ) ដើម្បីឱ្យវា Active មុនគេពេលបើកកម្មវិធី
  const [timeframe, setTimeframe] = useState("custom");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const EXCHANGE_RATE = 4000;
  const COLORS = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#06b6d4",
    "#6366f1",
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
    const txDate = new Date(dateInput);

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
          date: txDate.toLocaleDateString("km-KH"),
          createdAt: txDate,
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
          date: txDate.toLocaleDateString("km-KH"),
          createdAt: txDate,
        });
      }
      setText("");
      setAmount("");
      setDateInput(new Date().toISOString().split("T")[0]);
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

    if (transaction.createdAt) {
      const tDate = transaction.createdAt?.toDate
        ? transaction.createdAt.toDate()
        : new Date(transaction.createdAt);
      const year = tDate.getFullYear();
      const month = String(tDate.getMonth() + 1).padStart(2, "0");
      const day = String(tDate.getDate()).padStart(2, "0");
      setDateInput(`${year}-${month}-${day}`);
    }

    setEditingId(transaction.id);
    setShowHistory(true);
  };

  const deleteTransaction = async (id) => {
    const isConfirm = window.confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?");
    if (isConfirm) {
      try {
        await deleteDoc(doc(db, "transactions", id));
      } catch (error) {
        console.error("មានបញ្ហាក្នុងការលុបទិន្នន័យ: ", error);
      }
    }
  };

  const currentDate = new Date();
  const filteredTransactions = transactions.filter((t) => {
    const tDate = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);

    if (timeframe === "custom") {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      return tDate >= start && tDate <= end;
    }

    if (timeframe === "month") {
      const [year, month] = selectedMonth.split("-");
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

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredTransactions
    .filter((t) => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;

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

  const exportToExcel = () => {
    if (filteredTransactions.length === 0)
      return alert("មិនមានទិន្នន័យសម្រាប់ Export ទេ!");
    const dataToExport = filteredTransactions.map((t) => ({
      "កាលបរិច្ឆេទ (Date)": t.date,
      "ការពិពណ៌នា (Description)": t.text,
      "ប្រភេទ (Category)": t.category,
      "ចំណូល/ចំណាយ (Type)":
        t.type === "income" ? "ចំណូល (Income)" : "ចំណាយ (Expense)",
      "ទឹកប្រាក់ $ (USD)": t.type === "income" ? t.amount : -t.amount,
      "ទឹកប្រាក់ ៛ (KHR)":
        t.type === "income"
          ? t.amount * EXCHANGE_RATE
          : -(t.amount * EXCHANGE_RATE),
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

    let fileName = `Expense_Report_${timeframe}.xlsx`;
    if (timeframe === "custom")
      fileName = `Expense_Report_${startDate}_to_${endDate}.xlsx`;
    if (timeframe === "month")
      fileName = `Expense_Report_${selectedMonth}.xlsx`;
    if (timeframe === "year") fileName = `Expense_Report_Year.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const getBalanceTitle = () => {
    if (timeframe === "custom")
      return `សមតុល្យពីថ្ងៃ ${startDate} ដល់ ${endDate}`;
    if (timeframe === "month") return `សមតុល្យប្រចាំខែ ${selectedMonth}`;
    if (timeframe === "year") return "សមតុល្យឆ្នាំនេះ";
    return "សមតុល្យ";
  };

  const uniqueDescriptions = Array.from(
    new Set(transactions.map((t) => t.text)),
  ).filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans print:bg-white print:p-0">
      <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-3xl print:shadow-none print:w-full print:max-w-none print:p-0">
        <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-6 tracking-tight print:hidden">
          បញ្ជីចំណូលចំណាយ
        </h1>

        {/* របារជម្រើសពេលវេលាថ្មី (ដក "សរុបទាំងអស់" និងដាក់ "ចន្លោះថ្ងៃ" មុនគេ) */}
        <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-xl mb-4 shadow-inner print:hidden max-w-lg mx-auto">
          <button
            onClick={() => setTimeframe("custom")}
            className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "custom" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ចន្លោះថ្ងៃ
          </button>
          <button
            onClick={() => setTimeframe("month")}
            className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "month" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ប្រចាំខែ
          </button>
          <button
            onClick={() => setTimeframe("year")}
            className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all ${timeframe === "year" ? "bg-white shadow-md text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ឆ្នាំនេះ
          </button>
        </div>

        {timeframe === "custom" && (
          <div className="flex justify-center items-center gap-2 mb-4 relative print:hidden max-w-lg mx-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 bg-white border-2 border-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
              title="ថ្ងៃចាប់ផ្តើម"
            />
            <span className="font-bold text-slate-400 text-sm">ដល់</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 bg-white border-2 border-indigo-100 text-indigo-700 font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
              title="ថ្ងៃបញ្ចប់"
            />
          </div>
        )}

        {timeframe === "month" && (
          <div className="flex justify-center mb-4 relative print:hidden">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border-2 border-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
            />
          </div>
        )}

        <div className="flex gap-2 mb-6 justify-center print:hidden max-w-lg mx-auto">
          <button
            onClick={exportToExcel}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>📊</span> Export Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>📄</span> Save as PDF / Print
          </button>
        </div>

        <div className="flex flex-col md:flex-row print:flex-row gap-4 mb-6 print:mb-4">
          <div
            className={`bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl shadow-md print:shadow-none print:break-inside-avoid flex flex-col justify-center ${pieData.length > 0 ? "w-full md:w-1/2 print:w-1/2" : "w-full"}`}
          >
            <p className="text-sm font-medium opacity-90 text-center truncate">
              {getBalanceTitle()}
            </p>
            <div className="text-center my-2">
              <h2 className="text-4xl font-black">${balance.toFixed(2)}</h2>
              <p className="text-lg font-bold text-blue-200 mt-1">
                ≈ {(balance * EXCHANGE_RATE).toLocaleString("km-KH")} ៛
              </p>
            </div>
            <div className="flex justify-between mt-4 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
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

          {pieData.length > 0 && (
            <div className="w-full md:w-1/2 print:w-1/2 p-4 bg-slate-50 rounded-2xl border border-slate-100 print:border-none print:bg-white print:break-inside-avoid flex flex-col justify-center">
              <h3 className="text-center text-sm font-bold text-slate-600 mb-2">
                ក្រាបចំណាយតាមប្រភេទ
              </h3>
              <div className="h-44">
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
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className={`max-w-lg mx-auto mb-4 p-4 rounded-2xl border transition-all print:hidden ${editingId ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100"}`}
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
                  setDateInput(new Date().toISOString().split("T")[0]);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-200 px-2 py-1 rounded"
              >
                បោះបង់
              </button>
            )}
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                list="desc-suggestions"
                placeholder="ការពិពណ៌នា..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoComplete="off"
              />
              <datalist id="desc-suggestions">
                {uniqueDescriptions.map((desc, idx) => (
                  <option key={idx} value={desc} />
                ))}
              </datalist>
            </div>

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
                <option value="ថ្នាំពេទ្យនិងសុខភាព">ថ្នាំពេទ្យនិងសុខភាព</option>
                <option value="សម្រស់">សម្រស់</option>
                <option value="ការសិក្សា">ការសិក្សា</option>
                <option value="កូន">កូន</option>
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 cursor-pointer"
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
              >
                <option value="expense">📉 ចំណាយ (Expense)</option>
                <option value="income">📈 ចំណូល (Income)</option>
              </select>
            </div>
            <button
              type="submit"
              className={`w-full text-white font-bold p-3 rounded-xl transition-all shadow-md ${editingId ? "bg-emerald-500 hover:bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              {editingId ? "រក្សាទុកការកែប្រែ" : "បញ្ចូលទិន្នន័យ"}
            </button>
          </div>
        </form>

        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 mb-2 print:hidden"
          >
            {showHistory
              ? "លាក់ប្រវត្តិប្រតិបត្តិការ 🔼"
              : "មើលប្រវត្តិប្រតិបត្តិការ 🔽"}
          </button>

          {showHistory && (
            <div className="mt-4 transition-all duration-300 print:hidden">
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
                      មិនមានទិន្នន័យក្នុងចន្លោះពេលនេះទេ...
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
                      <div className="flex flex-col pl-3 w-1/2">
                        <span className="text-slate-800 font-bold text-md truncate">
                          {t.text}
                        </span>
                        <span className="text-xs text-slate-500 font-medium mt-0.5">
                          {t.date} •{" "}
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                            {t.category}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-black text-[17px] leading-tight ${t.type === "income" ? "text-green-500" : "text-red-500"}`}
                          >
                            {t.type === "income" ? "+" : "-"}$
                            {t.amount.toFixed(2)}
                          </span>
                          <span
                            className={`text-[11px] font-bold opacity-75 mt-0.5 ${t.type === "income" ? "text-green-600" : "text-red-600"}`}
                          >
                            {t.type === "income" ? "+" : "-"}
                            {(t.amount * EXCHANGE_RATE).toLocaleString(
                              "km-KH",
                            )}{" "}
                            ៛
                          </span>
                        </div>
                        <div className="flex gap-1 border-l pl-2 border-slate-100">
                          <button
                            onClick={() => handleEdit(t)}
                            className="text-blue-400 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteTransaction(t.id)}
                            className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="hidden print:block mt-8">
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">
            តារាងប្រតិបត្តិការលម្អិត
          </h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border p-2">កាលបរិច្ឆេទ</th>
                <th className="border p-2">ការពិពណ៌នា</th>
                <th className="border p-2">ប្រភេទ</th>
                <th className="border p-2 text-right">ទឹកប្រាក់ (USD)</th>
                <th className="border p-2 text-right">ទឹកប្រាក់ (KHR)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="border p-2">{t.date}</td>
                  <td className="border p-2 font-medium">{t.text}</td>
                  <td className="border p-2">
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                      {t.category}
                    </span>
                  </td>
                  <td
                    className={`border p-2 text-right font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}
                  >
                    {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
                  </td>
                  <td
                    className={`border p-2 text-right font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}
                  >
                    {t.type === "income" ? "+" : "-"}
                    {(t.amount * EXCHANGE_RATE).toLocaleString("km-KH")} ៛
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
