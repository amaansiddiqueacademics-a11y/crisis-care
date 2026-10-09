const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/components/ambulance/AmbulancePortal.jsx', 'utf8');

const oldLogin = `          <form onSubmit={e => { e.preventDefault(); loginAmbulance(badgeId, password); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Paramedic Badge ID
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="text" value={badgeId} onChange={e => setBadgeId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60 placeholder-[rgba(255,255,255,0.25)]"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[11px] text-[rgba(255,255,255,0.4)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Demo password: <strong className="text-white font-mono">paramedic123</strong>
            </div>

            <button type="submit" className="w-full py-3 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 transition">
              AUTHENTICATE ATTENDANT SESSION
            </button>
          </form>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.07)] text-center">
            <button
              onClick={() => loginAmbulance('PARA-409', 'paramedic123')}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
            >
              ⚡ 1-Click Demo Login — Dr. Ananya Roy (ALS Lead)
            </button>
          </div>`;

const newLogin = `          {/* Credentials verified against ambulance_attendants table in PostgreSQL */}
          <form onSubmit={e => { e.preventDefault(); loginAmbulance(badgeId, password); }} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Paramedic Badge ID
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="text" value={badgeId} onChange={e => setBadgeId(e.target.value)}
                  placeholder="e.g. PARA-409"
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60 placeholder-[rgba(255,255,255,0.25)]"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[rgba(255,255,255,0.5)] uppercase tracking-wider mb-1.5">
                Access Password
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[rgba(255,255,255,0.3)] absolute left-3.5 top-3" />
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-white outline-none focus:border-amber-600/60"
                  style={{ color: '#fff', WebkitTextFillColor: '#fff' }}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] text-[11px] text-[rgba(255,255,255,0.4)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Demo: <strong className="text-white font-mono">PARA-409</strong> / <strong className="text-white font-mono">paramedic123</strong>
            </div>

            <button type="submit" className="w-full py-3 rounded-xl font-black text-xs text-white bg-amber-700 hover:bg-amber-600 transition">
              AUTHENTICATE ATTENDANT SESSION
            </button>
          </form>

          <div className="pt-2 border-t border-[rgba(255,255,255,0.07)] space-y-1.5 text-center">
            <button
              onClick={() => loginAmbulance('PARA-409', 'paramedic123')}
              className="block w-full text-xs font-semibold text-amber-400 hover:text-amber-300 transition"
            >
              ⚡ 1-Click Demo — Dr. Ananya Roy (ALS Lead, PARA-409)
            </button>
            <button
              onClick={() => loginAmbulance('PARA-101', 'paramedic123')}
              className="block w-full text-xs font-semibold text-amber-500/70 hover:text-amber-400 transition"
            >
              ⚡ 1-Click Demo — Ravi Kumar (EMT, PARA-101)
            </button>
          </div>`;

code = code.replace(oldLogin, newLogin);

const oldHeader = `            <h1 className="text-lg font-black text-white">{ambulanceAuth.name}</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              {ambulanceAuth.callsign} • Badge: <span className="font-mono">{ambulanceAuth.badgeId}</span>
            </p>`;
const newHeader = `            <h1 className="text-lg font-black text-white">{ambulanceAuth.name}</h1>
            <p className="text-xs text-[rgba(255,255,255,0.4)]">
              {ambulanceAuth.callsign} • Badge: <span className="font-mono">{ambulanceAuth.badgeId}</span>
            </p>
            {ambulanceAuth.email && (
              <p className="text-[10px] text-[rgba(255,255,255,0.3)] mt-0.5">{ambulanceAuth.email}</p>
            )}`;

code = code.replace(oldHeader, newHeader);

fs.writeFileSync('frontend/frontend/src/components/ambulance/AmbulancePortal.jsx', code);
