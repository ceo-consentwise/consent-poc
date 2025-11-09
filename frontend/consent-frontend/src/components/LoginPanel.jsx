// frontend/consent-frontend/src/components/LoginPanel.jsx
import { useState } from "react";

export default function LoginPanel({ onLogin, loginError }) {
  const [username, setUsername] = useState("operator");
  const [password, setPassword] = useState("op123");
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <div style={{
      border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#fff",
      marginBottom: 12
    }}>
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        <h3 style={{margin:0, flex:1}}>Login</h3>
        <button onClick={()=>setShow(false)} style={{cursor:"pointer"}} title="Hide">×</button>
      </div>
      <div style={{display:"grid", gap:8, marginTop:8}}>
        <label style={{display:"grid", gap:4}}>
          <span>Username</span>
          <input value={username} onChange={e=>setUsername(e.target.value)}
                 style={{ padding:8, border:"1px solid #cfcfcf", borderRadius:6 }} />
        </label>
        <label style={{display:"grid", gap:4}}>
          <span>Password</span>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                 style={{ padding:8, border:"1px solid #cfcfcf", borderRadius:6 }} />
        </label>
        <div style={{display:"flex", gap:8}}>
          <button onClick={()=>onLogin(username, password)} style={{ padding:"8px 12px", borderRadius:6, cursor:"pointer" }}>
            Sign In
          </button>
          {loginError ? <span style={{color:"#b01911"}}>{String(loginError)}</span> : null}
        </div>
        <div style={{fontSize:12, color:"#666"}}>
          After login, the app will attach <code>Authorization: Bearer &lt;token&gt;</code> and your Operator as <code>X-Actor</code>.
        </div>
      </div>
    </div>
  );
}
