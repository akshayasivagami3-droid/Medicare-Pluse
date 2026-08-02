import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, deleteDoc,
  query, orderBy, onSnapshot
} from 'firebase/firestore';

/* ============================================
   FIREBASE CONFIG
============================================ */
const firebaseConfig = {
  apiKey: "AIzaSyBv34maam2ftVnYbg4XWkVQGdOJ50F36cs",
  authDomain: "medicare-plus-517fa.firebaseapp.com",
  projectId: "medicare-plus-517fa",
  storageBucket: "medicare-plus-517fa.firebasestorage.app",
  messagingSenderId: "902480599933",
  appId: "1:902480599933:web:feff8e51256df1ae73ca14",
  measurementId: "G-KSBGSXYG4S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ============================================
   GROQ API — used only for Healing Photo Tracker (vision)
============================================ */
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;

async function askGroqVision(base64Image, mimeType, promptText) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function askGroqChat(messages, systemPrompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
}

/* ============================================
   RULE-BASED DIET PLANS (no API needed, instant)
============================================ */
const DIET_PLANS = {
  diabetes: {
    BREAKFAST: 'Vegetable oats upma with a boiled egg',
    LUNCH: 'Brown rice, dal, and a large portion of leafy greens',
    DINNER: 'Grilled fish or paneer with sauteed vegetables',
    SNACKS: 'A handful of almonds or roasted chana',
    AVOID: 'White rice, sugary drinks, fried snacks, refined sugar',
    TIP: 'Eat meals at the same time daily to keep blood sugar stable.'
  },
  hypertension: {
    BREAKFAST: 'Vegetable poha with unsalted peanuts',
    LUNCH: 'Millet roti, dal, and steamed vegetables (low salt)',
    DINNER: 'Grilled chicken or tofu with a fresh salad',
    SNACKS: 'Fresh fruit like banana or papaya',
    AVOID: 'Pickles, papad, processed food, excess salt',
    TIP: 'Use herbs and lemon instead of extra salt for flavor.'
  },
  cardiac: {
    BREAKFAST: 'Oats with berries and a few walnuts',
    LUNCH: 'Brown rice, dal, and steamed vegetables (low oil)',
    DINNER: 'Grilled fish with a side of greens',
    SNACKS: 'Roasted makhana (fox nuts)',
    AVOID: 'Red meat, deep-fried food, excess butter/ghee',
    TIP: 'Choose grilled or steamed over fried whenever possible.'
  },
  general: {
    BREAKFAST: 'Idli or dosa with sambar and chutney',
    LUNCH: 'Rice, dal, vegetable curry, and curd',
    DINNER: 'Chapati with a light vegetable curry',
    SNACKS: 'Seasonal fruits or sprouts chaat',
    AVOID: 'Excess oil, late-night heavy meals, sugary beverages',
    TIP: 'Stay hydrated — aim for 8 glasses of water a day.'
  }
};

function getDietPlanForCondition(condition) {
  const c = (condition || '').toLowerCase();
  if (c.includes('diabet')) return DIET_PLANS.diabetes;
  if (c.includes('hypertension') || c.includes('blood pressure') || c.includes('bp')) return DIET_PLANS.hypertension;
  if (c.includes('cardiac') || c.includes('heart')) return DIET_PLANS.cardiac;
  return DIET_PLANS.general;
}

/* ============================================
   DESIGN TOKENS
============================================ */
const T = {
  bg: '#FAF8F5', surface: '#FFFFFF', primary: '#1F3A3D', primaryLt: '#2D5F5D',
  accent: '#E8927C', accentLt: '#F2E4DE', textDark: '#1A2421', textMid: '#5C6B68',
  success: '#4A7C59', successBg: '#E3EDE5', danger: '#C1502E', dangerBg: '#F7E3DC',
  border: '#E8E4DE'
};

const FONTS = (
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
);

/* ============================================
   SHARED UI PIECES
============================================ */
function Icon({ children }) { return <span className="text-lg leading-none">{children}</span>; }

function Card({ children, className = '', style = {} }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: T.surface, border: `1px solid ${T.border}`, ...style }}>{children}</div>;
}

function Button({ children, onClick, variant = 'primary', className = '', disabled, style = {} }) {
  const styles = {
    primary: { background: T.primary, color: '#fff' },
    accent: { background: T.accent, color: '#fff' },
    ghost: { background: 'transparent', color: T.primary, border: `1px solid ${T.border}` }
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 ${className}`}
      style={{ ...styles[variant], ...style }}>
      {children}
    </button>
  );
}

function PageHeader({ eyebrow, title }) {
  return (
    <div className="mb-8">
      <p className="text-xs uppercase tracking-widest mb-1.5" style={{ color: T.accent, letterSpacing: '0.12em', fontWeight: 600 }}>{eyebrow}</p>
      <h1 className="text-3xl" style={{ fontFamily: "'Fraunces', serif", color: T.textDark, fontWeight: 500 }}>{title}</h1>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="page-enter">
      <div className="skeleton" style={{ width: '140px', height: '12px', marginBottom: '10px' }} />
      <div className="skeleton" style={{ width: '260px', height: '32px', marginBottom: '32px' }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton" style={{ height: '120px' }} />
        <div className="skeleton" style={{ height: '120px' }} />
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'chatbot', label: 'AI Assistant', icon: '💬' },
  { id: 'history', label: 'Patient History', icon: '📋' },
  { id: 'medications', label: 'Medication Reminder', icon: '⏰' },
  { id: 'doctors', label: 'Book Doctor', icon: '🩺' },
  { id: 'medicines', label: 'Medicine Store', icon: '💊' },
  { id: 'diet', label: 'Diet Plan', icon: '🥗' },
  { id: 'healing', label: 'Healing Tracker', icon: '📷' },
  { id: 'emergency', label: 'Emergency', icon: '🚨' },
  { id: 'insurance', label: 'Insurance', icon: '🗂️' },
];

/* ============================================
   AUTH SCREEN
============================================ */
function AuthScreen() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!email || !password) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(e.message.replace('Firebase: ', '').replace(/\(auth\/|\)/g, ''));
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: T.primary, fontFamily: "'Inter', sans-serif" }}>
      {FONTS}
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest mb-2 text-center" style={{ color: T.accent, letterSpacing: '0.12em', fontWeight: 600 }}>Welcome to</p>
        <h1 className="text-4xl text-center mb-10" style={{ fontFamily: "'Fraunces', serif", color: '#fff', fontWeight: 500 }}>MediCare+</h1>
        <div className="rounded-2xl p-7" style={{ background: T.surface }}>
          <h2 className="font-medium mb-5" style={{ color: T.textDark }}>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: T.textMid }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: T.textMid }}>Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            </div>
            {error && <p className="text-xs" style={{ color: T.danger }}>{error}</p>}
            <Button onClick={handleSubmit} disabled={loading || !email || !password} className="w-full mt-2">
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
            </Button>
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="w-full text-center text-sm pt-3 transition-colors"
              style={{ color: T.textMid, borderTop: `1px solid ${T.border}`, marginTop: '8px', paddingTop: '16px' }}
              onMouseEnter={e => e.currentTarget.style.color = T.accent}
              onMouseLeave={e => e.currentTarget.style.color = T.textMid}>
              {mode === 'login' ? (
                <>New here? <span style={{ color: T.primary, fontWeight: 600 }}>Create an account</span></>
              ) : (
                <>Already have an account? <span style={{ color: T.primary, fontWeight: 600 }}>Log in</span></>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   PROFILE SETUP
============================================ */
function ProfileSetup({ user, onComplete }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [condition, setCondition] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name || !age) return;
    setSaving(true);
    const profile = { name, age, condition: condition || 'General wellness', email: user.email, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'patients', user.uid), profile);
    setSaving(false);
    onComplete(profile);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: T.primary, fontFamily: "'Inter', sans-serif" }}>
      {FONTS}
      <div className="w-full max-w-md">
        <h1 className="text-3xl text-center mb-8" style={{ fontFamily: "'Fraunces', serif", color: '#fff', fontWeight: 500 }}>One last step</h1>
        <div className="rounded-2xl p-7" style={{ background: T.surface }}>
          <h2 className="font-medium mb-5" style={{ color: T.textDark }}>Set up your health profile</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: T.textMid }}>Full name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ramesh Kumar"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: T.textMid }}>Age</label>
              <input value={age} onChange={e => setAge(e.target.value)} placeholder="40" type="number"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: T.textMid }}>Any existing condition? (optional)</label>
              <input value={condition} onChange={e => setCondition(e.target.value)} placeholder="e.g. Diabetes, Hypertension"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            </div>
            <Button onClick={handleSubmit} disabled={saving || !name || !age} className="w-full mt-2">
              {saving ? 'Setting up...' : 'Get started'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   CHATBOT — uses Groq text chat
============================================ */
function Chatbot({ patient }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hi ${patient.name.split(' ')[0]}, I'm your health assistant. Tell me what's going on and I'll help you figure out next steps. I'm not a doctor — for anything serious, I'll tell you to see one.` }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    const systemPrompt = `You are a careful, warm medical assistant inside a healthcare app called MediCare+.
Patient context: Name: ${patient.name}, Age: ${patient.age}, Known condition: ${patient.condition}.
Rules:
- You are NOT a replacement for a doctor. Never give a definitive diagnosis.
- Assess urgency: mild (self-care advice), moderate (see a doctor within days), severe (see a doctor urgently), emergency (say clearly: call emergency services / go to ER now).
- Keep responses concise, warm, and clear. Use plain language, not jargon.
- If symptoms suggest emergency, lead with the urgency clearly.
- End with a gentle reminder to consult a real doctor for anything beyond mild.`;

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));
      const reply = await askGroqChat(apiMessages, systemPrompt);
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages([...newMessages, { role: 'assistant', content: "Sorry, I couldn't process that right now. Please try again." }]);
    }
    setSending(false);
  }

  return (
    <div>
      <PageHeader eyebrow="AI Assistant" title="Talk through your symptoms" />
      <Card className="flex flex-col" style={{ height: '65vh' }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={{ background: m.role === 'user' ? T.primary : T.bg, color: m.role === 'user' ? '#fff' : T.textDark, border: m.role === 'assistant' ? `1px solid ${T.border}` : 'none' }}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div className="flex justify-start"><div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: T.bg, color: T.textMid, border: `1px solid ${T.border}` }}>Thinking...</div></div>}
          <div ref={scrollRef} />
        </div>
        <div className="p-4 flex gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Describe how you're feeling..." className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
          <Button onClick={handleSend} disabled={sending || !input.trim()}>Send</Button>
        </div>
      </Card>
    </div>
  );
}

/* ============================================
   MEDICATION REMINDER — daily check-off tracker
============================================ */
function todayKey() {
  return new Date().toISOString().split('T')[0]; // e.g. "2026-08-02"
}

function MedicationReminder({ user }) {
  const [meds, setMeds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', times: [] });
  const [timeInput, setTimeInput] = useState('Morning');
  const [todayLog, setTodayLog] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'patients', user.uid, 'medications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setMeds(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    getDoc(doc(db, 'patients', user.uid, 'medicationLogs', todayKey())).then(snap => {
      if (snap.exists()) setTodayLog(snap.data());
      setLoaded(true);
    });
    return unsub;
  }, [user.uid]);

  function addTimeSlot() {
    if (!timeInput || newMed.times.includes(timeInput)) return;
    setNewMed({ ...newMed, times: [...newMed.times, timeInput] });
  }
  function removeTimeSlot(t) {
    setNewMed({ ...newMed, times: newMed.times.filter(x => x !== t) });
  }

  async function addMedication() {
    if (!newMed.name || newMed.times.length === 0) return;
    await addDoc(collection(db, 'patients', user.uid, 'medications'), { ...newMed, createdAt: new Date().toISOString() });
    setNewMed({ name: '', dosage: '', times: [] });
    setShowForm(false);
  }

  async function deleteMedication(id) {
    await deleteDoc(doc(db, 'patients', user.uid, 'medications', id));
  }

  async function toggleDose(medId, time) {
    const key = `${medId}_${time}`;
    const updated = { ...todayLog, [key]: !todayLog[key] };
    setTodayLog(updated);
    await setDoc(doc(db, 'patients', user.uid, 'medicationLogs', todayKey()), updated);
  }

  if (!loaded) return <SkeletonLoader />;

  const totalDoses = meds.reduce((sum, m) => sum + m.times.length, 0);
  const takenDoses = meds.reduce((sum, m) => sum + m.times.filter(t => todayLog[`${m.id}_${t}`]).length, 0);
  const adherencePercent = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

  return (
    <div>
      <PageHeader eyebrow="Daily Tracking" title="Medication reminder" />

      {meds.length > 0 && (
        <Card className="p-6 mb-6" style={{ background: T.primary, border: 'none' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm mb-1" style={{ color: T.accent }}>Today's adherence</p>
              <p className="text-2xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: '#fff' }}>
                {takenDoses} of {totalDoses} doses taken
              </p>
            </div>
            <span className="text-3xl font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.accent }}>
              {adherencePercent}%
            </span>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: T.textDark }}>Your medications</h3>
        <Button variant="ghost" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add medication'}</Button>
      </div>

      {showForm && (
        <Card className="p-5 mb-4">
          <div className="space-y-3">
            <input value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} placeholder="Medication name (e.g. Metformin)"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <input value={newMed.dosage} onChange={e => setNewMed({ ...newMed, dosage: e.target.value })} placeholder="Dosage (e.g. 500mg)"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: T.textMid }}>When do you take it?</p>
              <div className="flex gap-2 mb-2">
                <select value={timeInput} onChange={e => setTimeInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }}>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                  <option>Night</option>
                </select>
                <Button variant="ghost" onClick={addTimeSlot}>Add</Button>
              </div>
              {newMed.times.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {newMed.times.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: T.accentLt, color: T.accent }}>
                      {t}
                      <button onClick={() => removeTimeSlot(t)} style={{ color: T.accent }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={addMedication}>Save medication</Button>
          </div>
        </Card>
      )}

      {meds.length === 0 && !showForm && (
        <Card className="p-10 text-center">
          <div className="text-3xl mb-3">⏰</div>
          <p className="text-sm" style={{ color: T.textMid }}>No medications added yet. Add one to start tracking daily doses.</p>
        </Card>
      )}

      <div className="space-y-3">
        {meds.map(m => (
          <Card key={m.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-sm" style={{ color: T.textDark }}>{m.name}</p>
                {m.dosage && <p className="text-xs mt-0.5" style={{ color: T.textMid }}>{m.dosage}</p>}
              </div>
              <button onClick={() => deleteMedication(m.id)} className="text-xs" style={{ color: T.danger }}>Remove</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {m.times.map(t => {
                const taken = !!todayLog[`${m.id}_${t}`];
                return (
                  <button key={t} onClick={() => toggleDose(m.id, t)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: taken ? T.successBg : T.bg,
                      color: taken ? T.success : T.textMid,
                      border: `1px solid ${taken ? T.success : T.border}`
                    }}>
                    {taken ? '✓ ' : ''}{t}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   PATIENT HISTORY
============================================ */
function PatientHistory({ user }) {
  const [records, setRecords] = useState([]);
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');
  const [newRecord, setNewRecord] = useState({ title: '', date: '', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const metaRef = doc(db, 'patients', user.uid, 'meta', 'info');
    getDoc(metaRef).then(snap => {
      if (snap.exists()) {
        setAllergies(snap.data().allergies || '');
        setMedications(snap.data().medications || '');
      }
      setLoaded(true);
    });
    const q = query(collection(db, 'patients', user.uid, 'records'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user.uid]);

  async function saveMeta(newAllergies, newMeds) {
    setAllergies(newAllergies);
    setMedications(newMeds);
    await setDoc(doc(db, 'patients', user.uid, 'meta', 'info'), { allergies: newAllergies, medications: newMeds });
  }

  async function addRecord() {
    if (!newRecord.title) return;
    await addDoc(collection(db, 'patients', user.uid, 'records'), { ...newRecord, createdAt: new Date().toISOString() });
    setNewRecord({ title: '', date: '', notes: '' });
    setShowForm(false);
  }

  async function deleteRecord(id) { await deleteDoc(doc(db, 'patients', user.uid, 'records', id)); }

  if (!loaded) return <SkeletonLoader />;

  return (
    <div>
      <PageHeader eyebrow="Medical Profile" title="Patient history" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: T.textDark }}>Known allergies</h3>
          <textarea value={allergies} onChange={e => saveMeta(e.target.value, medications)} placeholder="e.g. Penicillin, peanuts..."
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: `1px solid ${T.border}`, minHeight: '80px' }} />
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: T.textDark }}>Current medications</h3>
          <textarea value={medications} onChange={e => saveMeta(allergies, e.target.value)} placeholder="e.g. Metformin 500mg, twice daily..."
            className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: `1px solid ${T.border}`, minHeight: '80px' }} />
        </Card>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: T.textDark }}>Medical records timeline</h3>
        <Button variant="ghost" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add record'}</Button>
      </div>
      {showForm && (
        <Card className="p-5 mb-4">
          <div className="space-y-3">
            <input value={newRecord.title} onChange={e => setNewRecord({ ...newRecord, title: e.target.value })} placeholder="Record title (e.g. Blood test - CBC)"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <input value={newRecord.date} onChange={e => setNewRecord({ ...newRecord, date: e.target.value })} type="date"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <textarea value={newRecord.notes} onChange={e => setNewRecord({ ...newRecord, notes: e.target.value })} placeholder="Notes / results"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: `1px solid ${T.border}`, minHeight: '70px' }} />
            <Button onClick={addRecord}>Save record</Button>
          </div>
        </Card>
      )}
      {records.length === 0 && !showForm && (
        <Card className="p-10 text-center">
          <div className="text-3xl mb-3">📋</div>
          <p className="text-sm" style={{ color: T.textMid }}>No records yet. Add your first one to build your medical timeline.</p>
        </Card>
      )}
      <div className="space-y-3">
        {records.map(r => (
          <Card key={r.id} className="p-5 flex items-start justify-between">
            <div>
              <p className="font-medium text-sm" style={{ color: T.textDark }}>{r.title}</p>
              {r.date && <p className="text-xs mt-0.5" style={{ color: T.accent }}>{r.date}</p>}
              {r.notes && <p className="text-sm mt-2" style={{ color: T.textMid }}>{r.notes}</p>}
            </div>
            <button onClick={() => deleteRecord(r.id)} className="text-xs" style={{ color: T.danger }}>Remove</button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   DOCTOR BOOKING
============================================ */
const MOCK_DOCTORS = [
  { id: 1, name: 'Dr. Anjali Sharma', specialty: 'Cardiology', rating: 4.8, price: 500, nextSlot: 'Today, 4:00 PM' },
  { id: 2, name: 'Dr. Vikram Rao', specialty: 'General Physician', rating: 4.6, price: 300, nextSlot: 'Today, 2:30 PM' },
  { id: 3, name: 'Dr. Priya Menon', specialty: 'Orthopedic', rating: 4.9, price: 600, nextSlot: 'Tomorrow, 10:00 AM' },
  { id: 4, name: 'Dr. Karthik Iyer', specialty: 'Dermatology', rating: 4.7, price: 450, nextSlot: 'Tomorrow, 11:30 AM' },
  { id: 5, name: 'Dr. Meera Nair', specialty: 'Endocrinology', rating: 4.8, price: 550, nextSlot: 'Today, 6:00 PM' },
];

function DoctorBooking({ user }) {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'patients', user.uid, 'bookings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user.uid]);

  async function book(doctor) {
    await addDoc(collection(db, 'patients', user.uid, 'bookings'), {
      doctorName: doctor.name, specialty: doctor.specialty, slot: doctor.nextSlot, price: doctor.price, status: 'Confirmed', createdAt: new Date().toISOString()
    });
  }
  async function cancelBooking(id) { await deleteDoc(doc(db, 'patients', user.uid, 'bookings', id)); }

  const specialties = ['All', ...new Set(MOCK_DOCTORS.map(d => d.specialty))];
  const filtered = filter === 'All' ? MOCK_DOCTORS : MOCK_DOCTORS.filter(d => d.specialty === filter);

  return (
    <div>
      <PageHeader eyebrow="Consultations" title="Book a doctor" />
      {bookings.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium mb-3" style={{ color: T.textDark }}>Your bookings</h3>
          <div className="space-y-2">
            {bookings.map(b => (
              <Card key={b.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: T.textDark }}>{b.doctorName}</p>
                  <p className="text-xs" style={{ color: T.textMid }}>{b.specialty} · {b.slot}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: T.successBg, color: T.success }}>{b.status}</span>
                  <button onClick={() => cancelBooking(b.id)} className="text-xs" style={{ color: T.danger }}>Cancel</button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-5 flex-wrap">
        {specialties.map(s => (
          <button key={s} onClick={() => setFilter(s)} className="px-3.5 py-1.5 rounded-full text-xs font-medium"
            style={{ background: filter === s ? T.primary : T.surface, color: filter === s ? '#fff' : T.textMid, border: `1px solid ${filter === s ? T.primary : T.border}` }}>
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(doc_ => (
          <Card key={doc_.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-sm" style={{ color: T.textDark }}>{doc_.name}</p>
                <p className="text-xs mt-0.5" style={{ color: T.textMid }}>{doc_.specialty}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: T.accentLt, color: T.accent }}>★ {doc_.rating}</span>
            </div>
            <p className="text-xs mb-4" style={{ color: T.textMid }}>Next available: <span style={{ color: T.textDark, fontWeight: 500 }}>{doc_.nextSlot}</span></p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.textDark }}>₹{doc_.price}</span>
              <Button onClick={() => book(doc_)} variant="accent">Book now</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   MEDICINE STORE
============================================ */
const MOCK_MEDICINES = [
  { name: 'Paracetamol 500mg', prices: [{ pharmacy: 'MedPlus', price: 25 }, { pharmacy: 'Apollo Pharmacy', price: 32 }, { pharmacy: '1mg', price: 22 }] },
  { name: 'Aspirin 75mg', prices: [{ pharmacy: 'MedPlus', price: 18 }, { pharmacy: 'Apollo Pharmacy', price: 24 }, { pharmacy: '1mg', price: 20 }] },
  { name: 'Metformin 500mg', prices: [{ pharmacy: 'MedPlus', price: 45 }, { pharmacy: 'Apollo Pharmacy', price: 52 }, { pharmacy: '1mg', price: 40 }] },
  { name: 'Atorvastatin 20mg', prices: [{ pharmacy: 'MedPlus', price: 88 }, { pharmacy: 'Apollo Pharmacy', price: 95 }, { pharmacy: '1mg', price: 79 }] },
  { name: 'Ibuprofen 400mg', prices: [{ pharmacy: 'MedPlus', price: 30 }, { pharmacy: 'Apollo Pharmacy', price: 35 }, { pharmacy: '1mg', price: 28 }] },
];

function MedicineStore({ user }) {
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'patients', user.uid, 'medicineOrders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user.uid]);

  async function orderMedicine(medName, pharmacy, price) {
    await addDoc(collection(db, 'patients', user.uid, 'medicineOrders'), { medicine: medName, pharmacy, price, status: 'Out for delivery', createdAt: new Date().toISOString() });
  }

  const filtered = MOCK_MEDICINES.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader eyebrow="Marketplace" title="Compare & order medicine" />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search medicine name..."
        className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-6" style={{ border: `1px solid ${T.border}`, background: T.surface }} />
      {orders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium mb-3" style={{ color: T.textDark }}>Recent orders</h3>
          <div className="space-y-2">
            {orders.slice(0, 3).map(o => (
              <Card key={o.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: T.textDark }}>{o.medicine}</p>
                  <p className="text-xs" style={{ color: T.textMid }}>from {o.pharmacy}</p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: T.successBg, color: T.success }}>{o.status}</span>
              </Card>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4">
        {filtered.map((med, i) => {
          const cheapest = Math.min(...med.prices.map(p => p.price));
          return (
            <Card key={i} className="p-5">
              <p className="font-medium text-sm mb-3" style={{ color: T.textDark }}>{med.name}</p>
              <div className="space-y-2">
                {med.prices.map((p, j) => (
                  <div key={j} className="flex items-center justify-between py-1.5">
                    <span className="text-sm" style={{ color: T.textMid }}>{p.pharmacy}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums font-medium" style={{ fontFamily: "'IBM Plex Mono', monospace", color: p.price === cheapest ? T.success : T.textDark }}>
                        ₹{p.price} {p.price === cheapest && '· Best price'}
                      </span>
                      <Button variant={p.price === cheapest ? 'accent' : 'ghost'} onClick={() => orderMedicine(med.name, p.pharmacy, p.price)} className="!py-1.5 !px-3 !text-xs">Order</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================
   DIET PLAN — rule-based, no API
============================================ */
function DietPlan({ patient, user }) {
  const [plan, setPlan] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'patients', user.uid, 'meta', 'dietPlan')).then(snap => {
      if (snap.exists()) setPlan(snap.data());
      setLoaded(true);
    });
  }, [user.uid]);

  async function generatePlan() {
    const newPlan = getDietPlanForCondition(patient.condition);
    setPlan(newPlan);
    await setDoc(doc(db, 'patients', user.uid, 'meta', 'dietPlan'), newPlan);
  }

  if (!loaded) return <SkeletonLoader />;

  const rows = plan ? [
    { label: 'Breakfast', value: plan.BREAKFAST, icon: '🌅' },
    { label: 'Lunch', value: plan.LUNCH, icon: '☀️' },
    { label: 'Dinner', value: plan.DINNER, icon: '🌙' },
    { label: 'Snacks', value: plan.SNACKS, icon: '🍎' },
  ] : [];

  return (
    <div>
      <PageHeader eyebrow="Nutrition" title="Your diet plan" />
      {!plan && (
        <Card className="p-10 text-center">
          <p className="text-sm mb-4" style={{ color: T.textMid }}>Get a personalized diet plan based on your health profile ({patient.condition}).</p>
          <Button onClick={generatePlan} variant="accent">Generate my diet plan</Button>
        </Card>
      )}
      {plan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {rows.map((r, i) => (
              <Card key={i} className="p-5 flex items-start gap-3">
                <span className="text-xl">{r.icon}</span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: T.accent, letterSpacing: '0.06em' }}>{r.label}</p>
                  <p className="text-sm" style={{ color: T.textDark }}>{r.value}</p>
                </div>
              </Card>
            ))}
          </div>
          {plan.AVOID && (
            <Card className="p-5 mb-4" style={{ background: T.dangerBg, border: 'none' }}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: T.danger, letterSpacing: '0.06em' }}>Avoid</p>
              <p className="text-sm" style={{ color: T.textDark }}>{plan.AVOID}</p>
            </Card>
          )}
          {plan.TIP && (
            <Card className="p-5" style={{ background: T.primary, border: 'none' }}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: T.accent, letterSpacing: '0.06em' }}>Tip</p>
              <p className="text-sm" style={{ color: '#fff' }}>{plan.TIP}</p>
            </Card>
          )}
          <Button variant="ghost" onClick={generatePlan} className="mt-4">Regenerate plan</Button>
        </>
      )}
    </div>
  );
}

/* ============================================
   HEALING TRACKER — uses Gemini vision
============================================ */
function HealingTracker({ user }) {
  const [photos, setPhotos] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'patients', user.uid, 'healingPhotos'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setPhotos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user.uid]);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type;

      const visionPrompt = `You are analyzing a photo of skin/wound for a healthcare recovery tracking app. Look carefully for ALL of the following: swelling, redness, rashes, discoloration, bruising, discharge, or any unusual skin patterns. Respond ONLY in this exact format, no extra text:
SWELLING: [none/mild/moderate/severe]
COLOR: [describe actual skin color and any discoloration/redness seen]
RASH: [none, or describe location, appearance, and possible type if a rash/skin eruption is visible]
HEALING_PERCENT: [number 0-100, estimate of overall healing/recovery progress]
CONCERN: [none, or specific concern — infection signs, rash, unusual discharge, etc.]
NOTE: [one sentence summary, max 20 words]`;

      const text = await askGroqVision(base64, mediaType, visionPrompt);
      const parsed = {};
      text.split('\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) parsed[key.trim().toUpperCase()] = rest.join(':').trim();
      });

      await addDoc(collection(db, 'patients', user.uid, 'healingPhotos'), {
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        thumbnail: `data:${mediaType};base64,${base64}`,
        analysis: parsed,
        createdAt: new Date().toISOString()
      });
    } catch (err) { console.error(err); }
    setAnalyzing(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deletePhoto(id) {
    await deleteDoc(doc(db, 'patients', user.uid, 'healingPhotos', id));
  }

  const latest = photos[0];

  return (
    <div>
      <PageHeader eyebrow="Recovery" title="Healing photo tracker" />
      <Card className="p-8 mb-6 text-center" style={{ background: T.primary, border: 'none' }}>
        <p className="text-sm mb-4" style={{ color: '#9FB5B2' }}>Upload a daily photo — AI analyzes swelling, color, and healing progress</p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" id="photo-upload" />
        <label htmlFor="photo-upload">
          <span className="inline-block px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-opacity hover:opacity-90" style={{ background: T.accent, color: '#fff' }}>
            {analyzing ? 'Analyzing...' : '📷 Upload photo'}
          </span>
        </label>
      </Card>
      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="overflow-hidden relative">
            <img src={latest.thumbnail} alt="Healing progress" className="w-full h-56 object-cover" />
            <button onClick={() => deletePhoto(latest.id)}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>Delete</button>
          </Card>
          <Card className="p-6">
            <p className="text-xs uppercase tracking-wide mb-3" style={{ color: T.accent, letterSpacing: '0.06em', fontWeight: 600 }}>Latest analysis</p>
            {!latest.analysis.HEALING_PERCENT && !latest.analysis.SWELLING ? (
              <p className="text-sm" style={{ color: T.textMid }}>Analysis unavailable for this photo. Try uploading again.</p>
            ) : (
              <div className="space-y-3">
                {latest.analysis.HEALING_PERCENT && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: T.textMid }}>Healing progress</span>
                    <span className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.textDark }}>{latest.analysis.HEALING_PERCENT}%</span>
                  </div>
                )}
                {latest.analysis.SWELLING && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: T.textMid }}>Swelling</span>
                    <span className="text-sm" style={{ color: T.textDark }}>{latest.analysis.SWELLING}</span>
                  </div>
                )}
                {latest.analysis.RASH && latest.analysis.RASH.toLowerCase() !== 'none' && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm flex-shrink-0" style={{ color: T.textMid }}>Rash</span>
                    <span className="text-sm text-right ml-3" style={{ color: T.textDark }}>{latest.analysis.RASH}</span>
                  </div>
                )}
                {latest.analysis.COLOR && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm flex-shrink-0" style={{ color: T.textMid }}>Skin appearance</span>
                    <span className="text-sm text-right ml-3" style={{ color: T.textDark }}>{latest.analysis.COLOR}</span>
                  </div>
                )}
                {latest.analysis.CONCERN && latest.analysis.CONCERN.toLowerCase() !== 'none' && (
                  <div className="p-3 rounded-xl mt-2" style={{ background: T.dangerBg }}><p className="text-xs" style={{ color: T.danger }}>⚠ {latest.analysis.CONCERN}</p></div>
                )}
                {latest.analysis.NOTE && <p className="text-sm mt-2 pt-3" style={{ color: T.textMid, borderTop: `1px solid ${T.border}` }}>{latest.analysis.NOTE}</p>}
              </div>
            )}
          </Card>
        </div>
      )}
      {photos.length > 1 && (
        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: T.textDark }}>Timeline</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {photos.map(p => (
              <div key={p.id} className="flex-shrink-0 w-28 relative">
                <img src={p.thumbnail} alt={p.date} className="w-28 h-28 object-cover rounded-xl mb-1.5" />
                <button onClick={() => deletePhoto(p.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>✕</button>
                <p className="text-xs text-center" style={{ color: T.textMid }}>{p.date}</p>
                {p.analysis.HEALING_PERCENT && <p className="text-xs text-center font-medium" style={{ color: T.accent }}>{p.analysis.HEALING_PERCENT}%</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================
   EMERGENCY
============================================ */
function Emergency({ patient }) {
  const [confirming, setConfirming] = useState(false);
  const [activated, setActivated] = useState(false);
  const [steps, setSteps] = useState([]);

  async function triggerEmergency() {
    setActivated(true);
    setConfirming(false);
    setSteps([{ text: 'Emergency contact notified', done: false }, { text: 'Nearest hospital alerted', done: false }, { text: 'Medical profile shared', done: false }]);
    const timings = [800, 1800, 2800];
    timings.forEach((t, i) => {
      setTimeout(() => setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s)), t);
    });
  }
  function reset() { setActivated(false); setSteps([]); }

  return (
    <div>
      <PageHeader eyebrow="Urgent" title="Emergency alert" />
      {!activated && (
        <Card className="p-10 text-center" style={{ background: T.dangerBg, border: 'none' }}>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: T.textDark }}>
            This will immediately notify your emergency contact and share your medical profile with the nearest hospital.
          </p>
          {!confirming ? (
            <Button variant="ghost" onClick={() => setConfirming(true)} style={{ color: T.danger, borderColor: T.danger }}>🚨 Activate emergency alert</Button>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Button onClick={triggerEmergency} style={{ background: T.danger }}>Yes, confirm emergency</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          )}
        </Card>
      )}
      {activated && (
        <div>
          <Card className="p-6 mb-4">
            <h3 className="text-sm font-medium mb-4" style={{ color: T.textDark }}>Alert status</h3>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ background: s.done ? T.success : T.border, color: '#fff' }}>{s.done ? '✓' : ''}</div>
                  <span className="text-sm" style={{ color: s.done ? T.textDark : T.textMid }}>{s.text}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6 mb-4">
            <p className="text-xs uppercase tracking-wide mb-3" style={{ color: T.accent, letterSpacing: '0.06em', fontWeight: 600 }}>Shared medical data</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span style={{ color: T.textMid }}>Name: </span><span style={{ color: T.textDark }}>{patient.name}</span></div>
              <div><span style={{ color: T.textMid }}>Age: </span><span style={{ color: T.textDark }}>{patient.age}</span></div>
              <div className="col-span-2"><span style={{ color: T.textMid }}>Condition: </span><span style={{ color: T.textDark }}>{patient.condition}</span></div>
            </div>
          </Card>
          <Button variant="ghost" onClick={reset}>Close alert</Button>
        </div>
      )}
    </div>
  );
}

/* ============================================
   INSURANCE
============================================ */
function Insurance({ user }) {
  const [claims, setClaims] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [billAmount, setBillAmount] = useState('');
  const [hospital, setHospital] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'patients', user.uid, 'claims'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user.uid]);

  async function submitClaim() {
    if (!billAmount || !hospital) return;
    const amount = parseFloat(billAmount);
    const deductible = 5000;
    const copay = 0.1;
    const reimbursement = Math.max(0, (amount - deductible) * (1 - copay));

    const docRef = await addDoc(collection(db, 'patients', user.uid, 'claims'), {
      hospital, billAmount: amount, reimbursement: Math.round(reimbursement), status: 'Processing',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      createdAt: new Date().toISOString()
    });
    setBillAmount(''); setHospital(''); setShowForm(false);

    setTimeout(async () => {
      await setDoc(doc(db, 'patients', user.uid, 'claims', docRef.id), { status: 'Approved' }, { merge: true });
    }, 4000);
  }

  const totalClaimed = claims.reduce((s, c) => s + c.billAmount, 0);
  const totalReimbursed = claims.filter(c => c.status === 'Approved').reduce((s, c) => s + c.reimbursement, 0);

  return (
    <div>
      <PageHeader eyebrow="Claims" title="Insurance management" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: T.textMid, letterSpacing: '0.06em' }}>Total claimed</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.textDark }}>₹{totalClaimed.toLocaleString('en-IN')}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: T.textMid, letterSpacing: '0.06em' }}>Reimbursed</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.success }}>₹{totalReimbursed.toLocaleString('en-IN')}</p>
        </Card>
      </div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: T.textDark }}>Claims</h3>
        <Button variant="ghost" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Submit claim'}</Button>
      </div>
      {showForm && (
        <Card className="p-5 mb-4">
          <div className="space-y-3">
            <input value={hospital} onChange={e => setHospital(e.target.value)} placeholder="Hospital name" className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <input value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="Bill amount (₹)" type="number" className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none" style={{ border: `1px solid ${T.border}` }} />
            <Button onClick={submitClaim}>Submit claim</Button>
          </div>
        </Card>
      )}
      {claims.length === 0 && !showForm && (
        <Card className="p-10 text-center">
          <div className="text-3xl mb-3">🗂️</div>
          <p className="text-sm" style={{ color: T.textMid }}>No claims yet. Submit a hospital bill to get started.</p>
        </Card>
      )}
      <div className="space-y-3">
        {claims.map(c => (
          <Card key={c.id} className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: T.textDark }}>{c.hospital}</p>
              <p className="text-xs mt-0.5" style={{ color: T.textMid }}>{c.date} · Bill: ₹{c.billAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium tabular-nums" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.textDark }}>₹{c.reimbursement.toLocaleString('en-IN')}</p>
              <span className="text-xs px-2 py-0.5 rounded-full inline-block mt-1" style={{ background: c.status === 'Approved' ? T.successBg : T.accentLt, color: c.status === 'Approved' ? T.success : T.accent }}>{c.status}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   DASHBOARD
============================================ */
function Dashboard({ patient, setActivePage }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div>
      <PageHeader eyebrow="Overview" title={`${greeting}, ${patient.name.split(' ')[0]}`} />
      <div className="rounded-3xl p-8 mb-6" style={{ background: T.primary }}>
        <p className="text-sm mb-1" style={{ color: T.accent }}>Your health snapshot</p>
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Fraunces', serif", color: '#fff', fontWeight: 500 }}>Everything's on track today</h2>
        <p className="text-sm max-w-md" style={{ color: '#9FB5B2' }}>Track healing, book a consultation, or manage your health — all from one place.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { page: 'chatbot', icon: '💬', title: 'Ask the assistant', desc: 'Describe symptoms, get guidance' },
          { page: 'medications', icon: '⏰', title: 'Medication reminder', desc: 'Track today\'s doses' },
          { page: 'healing', icon: '📷', title: 'Upload healing photo', desc: 'Track your recovery' },
          { page: 'doctors', icon: '🩺', title: 'Book a doctor', desc: 'Video or in-person' },
          { page: 'medicines', icon: '💊', title: 'Order medicine', desc: 'Compare prices instantly' },
          { page: 'diet', icon: '🥗', title: 'Diet suggestions', desc: 'Personalized meal plan' },
          { page: 'history', icon: '📋', title: 'Patient history', desc: 'Records, allergies, meds' },
          { page: 'insurance', icon: '🗂️', title: 'Insurance claims', desc: 'Submit & track claims' },
        ].map(item => (
          <button key={item.page} onClick={() => setActivePage(item.page)}
            className="text-left rounded-2xl p-6 transition-transform hover:scale-[1.02]"
            style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: T.accentLt }}><Icon>{item.icon}</Icon></div>
            <h3 className="font-medium mb-1" style={{ color: T.textDark }}>{item.title}</h3>
            <p className="text-sm" style={{ color: T.textMid }}>{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================
   SIDEBAR
============================================ */
function Sidebar({ activePage, setActivePage, patient, user }) {
  const [open, setOpen] = useState(false);

  const content = (
    <>
      <div className="px-3 mb-10 flex items-center justify-between">
        <h1 className="text-xl" style={{ fontFamily: "'Fraunces', serif", color: '#fff', fontWeight: 500 }}>MediCare+</h1>
        <button className="md:hidden text-white" onClick={() => setOpen(false)}>✕</button>
      </div>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => { setActivePage(item.id); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left"
            style={{
              background: activePage === item.id ? 'rgba(232,146,124,0.14)' : 'transparent',
              color: activePage === item.id ? '#fff' : '#9FB5B2',
              fontWeight: activePage === item.id ? 500 : 400,
              borderLeft: activePage === item.id ? `3px solid ${T.accent}` : '3px solid transparent',
              marginLeft: '-3px'
            }}
            onMouseEnter={e => { if (activePage !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (activePage !== item.id) e.currentTarget.style.background = 'transparent'; }}>
            <Icon>{item.icon}</Icon>{item.label}
          </button>
        ))}
      </nav>
      <div className="px-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${T.accent}, #D97862)`,
              fontFamily: "'IBM Plex Mono', monospace",
              boxShadow: '0 0 0 2px rgba(255,255,255,0.15)'
            }}>{patient.name.charAt(0)}</div>
          <div className="min-w-0">
            <p className="text-sm truncate" style={{ color: '#fff' }}>{patient.name}</p>
            <p className="text-xs truncate" style={{ color: '#9FB5B2' }}>{patient.condition}</p>
          </div>
        </div>
        <button onClick={() => signOut(auth)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
          style={{ color: '#C9B8B2', background: 'rgba(232,146,124,0.08)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,146,124,0.16)'; e.currentTarget.style.color = '#F2B5A3'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(232,146,124,0.08)'; e.currentTarget.style.color = '#C9B8B2'; }}>
          <span style={{ fontSize: '15px' }}>⏻</span> Log out
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3" style={{ background: T.primary }}>
        <h1 className="text-lg" style={{ fontFamily: "'Fraunces', serif", color: '#fff', fontWeight: 500 }}>MediCare+</h1>
        <button className="text-white text-xl" onClick={() => setOpen(true)}>☰</button>
      </div>
      <div className="md:hidden" style={{ height: '56px' }} />
      {open && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 flex flex-col py-6 px-4" style={{ background: T.primary }}>{content}</div>
          <div className="flex-1" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />
        </div>
      )}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col py-8 px-4" style={{ background: T.primary, minHeight: '100vh' }}>
        {content}
      </aside>
    </>
  );
}

/* ============================================
   MAIN APP
============================================ */
export default function App() {
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        const snap = await getDoc(doc(db, 'patients', u.uid));
        if (snap.exists()) setPatient(snap.data());
        else setPatient(null);
      } else {
        setPatient(null);
      }
      setProfileLoading(false);
    });
    return unsub;
  }, []);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}><p style={{ color: T.textMid }}>Loading...</p></div>;
  }
  if (!user) return <AuthScreen />;
  if (profileLoading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}><p style={{ color: T.textMid }}>Loading your profile...</p></div>;
  }
  if (!patient) return <ProfileSetup user={user} onComplete={setPatient} />;

  return (
    <div className="min-h-screen w-full flex" style={{ background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      {FONTS}
      <Sidebar activePage={activePage} setActivePage={setActivePage} patient={patient} user={user} />
      <main className="flex-1 overflow-y-auto" style={{ maxHeight: '100vh' }}>
        <div key={activePage} className="max-w-5xl mx-auto px-6 md:px-8 py-8 md:py-10 page-enter">
          {activePage === 'dashboard' && <Dashboard patient={patient} setActivePage={setActivePage} />}
          {activePage === 'chatbot' && <Chatbot patient={patient} />}
          {activePage === 'medications' && <MedicationReminder user={user} />}
          {activePage === 'history' && <PatientHistory user={user} />}
          {activePage === 'doctors' && <DoctorBooking user={user} />}
          {activePage === 'medicines' && <MedicineStore user={user} />}
          {activePage === 'diet' && <DietPlan patient={patient} user={user} />}
          {activePage === 'healing' && <HealingTracker user={user} />}
          {activePage === 'emergency' && <Emergency patient={patient} />}
          {activePage === 'insurance' && <Insurance user={user} />}
        </div>
      </main>
    </div>
  );
}