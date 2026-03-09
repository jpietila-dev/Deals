import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://fddvfmvammontpbpdlcw.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHZmbXZhbW1vbnRwYnBkbGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODU5MDEsImV4cCI6MjA4ODY2MTkwMX0.hCvqo1fATPOskjo_eJcwBwpX8fpo-Wu41YyYUZ-WMG4"
);

const STAGES = ["New / Incoming", "Qualified", "Proposal Sent", "Negotiation", "Won / Closed", "Lost"];
const STAGE_CONFIG = {
  "New / Incoming": { color: "#60A5FA", bg: "#60A5FA18" },
  "Qualified":      { color: "#A78BFA", bg: "#A78BFA18" },
  "Proposal Sent":  { color: "#FCD34D", bg: "#FCD34D18" },
  "Negotiation":    { color: "#F97316", bg: "#F9731618" },
  "Won / Closed":   { color: "#4ADE80", bg: "#4ADE8018" },
  "Lost":           { color: "#F87171", bg: "#F8717118" },
};

const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v || 0);
const EMPTY_FORM = { name: "", contact: "", value: "", stage: "New / Incoming", date: new Date().toISOString().split("T")[0], notes: "" };

export default function App() {
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterStage, setFilterStage] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [saving, setSaving] = useState(false);
  const [showEmailParser, setShowEmailParser] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dealFiles, setDealFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => { fetchDeals(); }, []);

  const fetchDeals = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    if (!error) setOpps(data || []);
    setLoading(false);
  };

  const fetchFiles = async (dealId) => {
    const { data } = await supabase.from("deal_files").select("*").eq("deal_id", dealId).order("created_at", { ascending: false });
    setDealFiles(data || []);
  };

  const openDeal = async (o) => {
    setSelectedDeal(o);
    await fetchFiles(o.id);
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedDeal) return;
    setUploadingFile(true);
    const path = `${selectedDeal.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("deal-files").upload(path, file);
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from("deal-files").getPublicUrl(path);
      await supabase.from("deal_files").insert([{ deal_id: selectedDeal.id, name: file.name, url: publicUrl }]);
      await fetchFiles(selectedDeal.id);
    }
    setUploadingFile(false);
    e.target.value = "";
  };

  const deleteFile = async (fileId, fileUrl) => {
    const path = fileUrl.split("/deal-files/")[1];
    await supabase.storage.from("deal-files").remove([path]);
    await supabase.from("deal_files").delete().eq("id", fileId);
    setDealFiles(dealFiles.filter(f => f.id !== fileId));
  };

  const parseEmail = async () => {
    if (!emailText.trim()) return;
    setParsing(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Extract deal information from this email and return ONLY a JSON object with these fields:
- name: company or deal name (string)
- contact: email address of sender (string)
- value: estimated deal value as a number only, no $ or commas, 0 if not mentioned (number)
- notes: one sentence summary of the opportunity (string)
- stage: one of exactly these values: "New / Incoming", "Qualified", "Proposal Sent", "Negotiation", "Won / Closed", "Lost"

Email:
${emailText}

Return ONLY the JSON object, no other text.`
          }]
        })
      });
      const data = await response.json();
      const text = data.content[0].text;
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setForm({
        name: parsed.name || "",
        contact: parsed.contact || "",
        value: String(parsed.value || ""),
        stage: STAGES.includes(parsed.stage) ? parsed.stage : "New / Incoming",
        date: new Date().toISOString().split("T")[0],
        notes: parsed.notes || "",
      });
      setShowEmailParser(false);
      setEmailText("");
      setShowForm(true);
      setEditId(null);
    } catch (err) {
      alert("Could not parse email. Please try again or fill in manually.");
    }
    setParsing(false);
  };

  const saveOpp = async () => {
    if (!form.name.trim() || !form.value) return;
    setSaving(true);
    const entry = { name: form.name, contact: form.contact, value: Number(form.value), stage: form.stage, date: form.date, notes: form.notes };
    if (editId !== null) {
      await supabase.from("deals").update(entry).eq("id", editId);
      if (selectedDeal?.id === editId) setSelectedDeal({ ...selectedDeal, ...entry });
    } else {
      await supabase.from("deals").insert([entry]);
    }
    await fetchDeals();
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setSaving(false);
  };

  const del
