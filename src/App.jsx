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
// Import កញ្ចប់ថ្មី ប្រើជំនួស html2pdf
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  const [isExporting, setIsExporting] = useState(false);

  const [timeframe, setTimeframe] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
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
      console.error("Error: ", error);
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
      setDateInput(
        `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, "0")}-${String(tDate.getDate()).padStart(2, "0")}`,
      );
    }
    setEditingId(transaction.id);
    setShowHistory(true);
  };

  const deleteTransaction = async (id) => {
    if (window.confirm("តើអ្នកពិតជាចង់លុបទិន្នន័យនេះមែនទេ?")) {
      await deleteDoc(doc(db, "transactions", id));
    }
  };

  const currentDate = new Date();
  const filteredTransactions = transactions.filter((t) => {
    if (timeframe === "all") return true;
    const tDate = t.createdAt?.toDate
      ? t.createdAt.toDate()
      : new Date(t.createdAt);
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

  // ==========================================
  // មុខងារ Export ទៅជា Excel
  // ==========================================
  const exportToExcel = () => {
    if (filteredTransactions.length === 0)
      return alert("មិនមានទិន្នន័យសម្រាប់ Export ទេ!");
    const dataToExport = filteredTransactions.map((t) => ({
      "កាលបរិច្ឆេទ (Date)": t.date,
      "ការពិពណ៌នា (Description)": t.text,
      "ប្រភេទ (Category)": t.category,
      "ចំណូល/ចំណាយ (Type)": t.type === "income" ? "ចំណូល" : "ចំណាយ",
      "ទឹកប្រាក់ $ (USD)": t.type === "income" ? t.amount : -t.amount,
      "ទឹកប្រាក់ ៛ (KHR)":
        t.type === "income"
          ? t.amount * EXCHANGE_RATE
          : -(t.amount * EXCHANGE_RATE),
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(
      workbook,
      timeframe === "month"
        ? `Expense_Report_${selectedMonth}.xlsx`
        : `Expense_Report_${timeframe}.xlsx`,
    );
  };

  // ==========================================
  // មុខងារ 1-Click Export ទៅជា PDF (ថ្មី - មានស្ថេរភាពខ្ពស់)
  // ==========================================
  const exportToPDF = () => {
    if (filteredTransactions.length === 0)
      return alert("មិនមានទិន្នន័យសម្រាប់ Export ទេ!");

    setShowHistory(true);
    setIsExporting(true);

    // រង់ចាំ 800ms ឱ្យ UI រៀបចំខ្លួន និងលាតសន្ធឹងអស់សិន
    setTimeout(() => {
      const element = document.getElementById("pdf-content");

      html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      })
        .then((canvas) => {
          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF("p", "mm", "a4");

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const imgHeight = (canvas.height * pdfWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 0;

          // ដាក់រូបភាពចូលទំព័រទី១
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pageHeight;

          // មុខងារកាត់ទំព័រដោយស្វ័យប្រវត្តិ បើប្រវត្តិប្រតិបត្តិការវែងជាង ១ ទំព័រ
          while (heightLeft >= 0) {
            position = position - pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          pdf.save(
            timeframe === "month"
              ? `Expense_Report_${selectedMonth}.pdf`
              : `Expense_Report_${timeframe}.pdf`,
          );
          setIsExporting(false); // ត្រឡប់ UI មកធម្មតាវិញ
        })
        .catch((err) => {
          console.error("PDF Export Error: ", err);
          setIsExporting(false);
          alert("មានបញ្ហាក្នុងការទាញយក PDF សូមសាកល្បងម្ដងទៀត។");
        });
    }, 800);
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors ${isExporting ? "bg-white" : "bg-slate-100"}`}
    >
      {/* Container ដែលនឹងត្រូវថតយក (pdf-content) */}
      <div
        id="pdf-content"
        className={`bg-white p-6 w-full max-w-lg ${isExporting ? "rounded-none shadow-none" : "rounded-3xl shadow-xl"}`}
      >
        <h1 className="text-3xl font-extrabold text-center text-slate-800 mb-6 tracking-tight">
          បញ្ជីចំណូលចំណាយ
        </h1>

        {/* លាក់របារនេះពេលកំពុងទាញយក PDF */}
        {!isExporting && (
          <>
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-4 shadow-inner">
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
            {timeframe === "month" && (
              <div className="flex justify-center mb-4 relative">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white border-2 border-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer shadow-sm"
                />
              </div>
            )}
            <div className="flex gap-2 mb-6 justify-center">
              <button
                onClick={exportToExcel}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>📊</span> Export Excel
              </button>
              <button
                onClick={exportToPDF}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-xl shadow transition-colors text-sm flex items-center justify-center gap-2"
              >
                <span>⬇️</span> Download PDF
              </button>
            </div>
          </>
        )}

        {/* ផ្ទាំងបង្ហាញសមតុល្យ */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-2xl mb-6 shadow-md">
          <p className="text-sm font-medium opacity-90 text-center">
            {timeframe === "month"
              ? `សមតុល្យប្រចាំខែ ${selectedMonth}`
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
                {/* បិទចលនា (Animation) របស់ PieChart ជាបណ្តោះអាសន្នពេលកំពុង Export ការពារកុំឱ្យគាំង */}
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive={!isExporting}
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

        {/* ហ្វមបញ្ចូលទិន្នន័យ (លាក់បាត់ពេលកំពុង Export) */}
        {!isExporting && (
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
                    setDateInput(new Date().toISOString().split("T")[0]);
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
                  <option value="ថ្នាំពេទ្យនិងសុខភាព">
                    ថ្នាំពេទ្យនិងសុខភាព
                  </option>
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
        )}

        {/* ផ្ទាំងប្រវត្តិ */}
        {!isExporting && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-3 rounded-xl font-bold transition-all flex justify-center items-center gap-2 mb-2"
          >
            {showHistory
              ? "លាក់ប្រវត្តិប្រតិបត្តិការ 🔼"
              : "មើលប្រវត្តិប្រតិបត្តិការ 🔽"}
          </button>
        )}

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

            {/* ពេល Export យើងត្រូវដកកម្ពស់អតិបរមា (max-h) ចេញ ដើម្បីកុំឱ្យវាចេញ Scrollbar ក្នុង PDF */}
            <ul
              className={`space-y-3 pr-1 ${isExporting ? "" : "max-h-[300px] overflow-y-auto custom-scrollbar"}`}
            >
              {filteredTransactions.map((t) => (
                <li
                  key={t.id}
                  className="group flex justify-between items-center p-4 rounded-xl border shadow-sm transition-all relative overflow-hidden bg-white border-slate-100"
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
                        {t.type === "income" ? "+" : "-"}${t.amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] font-bold opacity-75 mt-0.5 ${t.type === "income" ? "text-green-600" : "text-red-600"}`}
                      >
                        {t.type === "income" ? "+" : "-"}
                        {(t.amount * EXCHANGE_RATE).toLocaleString("km-KH")} ៛
                      </span>
                    </div>
                    {/* លាក់សញ្ញា កែប្រែ/លុប ពេលកំពុងទាញយក PDF */}
                    {!isExporting && (
                      <div className="flex gap-1 border-l pl-2 border-slate-100">
                        <button
                          onClick={() => handleEdit(t)}
                          className="text-blue-400 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-lg transition-all"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteTransaction(t.id)}
                          className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-all"
                        >
                          ❌
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
