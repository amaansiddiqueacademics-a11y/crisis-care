const fs = require('fs');
let code = fs.readFileSync('frontend/frontend/src/components/client/ClientPortal.jsx', 'utf8');

const paramedicBox = `
            {/* Assigned Paramedic Info */}
            {!isAccepted && citizenIncident.paramedicName && (
              <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.1)] flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] tracking-wider">Assigned Paramedic</p>
                  <p className="text-sm font-bold text-white">{citizenIncident.paramedicName}</p>
                </div>
                <div className="ml-auto flex flex-col items-end">
                  <p className="text-[10px] uppercase font-bold text-[rgba(255,255,255,0.5)] tracking-wider">Badge ID / Unit</p>
                  <div className="flex gap-2">
                    <span className="font-mono text-xs font-bold text-amber-300 bg-amber-900/30 px-2 py-0.5 rounded border border-amber-500/30">{citizenIncident.paramedicBadge || 'PARA-409'}</span>
                    <span className="text-xs font-semibold text-white/70">{citizenIncident.assignedAmbulanceCallsign}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Location + emergency contact */}
`;

code = code.replace('{/* Location + emergency contact */}', paramedicBox);

// Also need to make sure User icon is imported from lucide-react in ClientPortal.jsx
if (!code.includes('User,')) {
    code = code.replace('import { MapPin', 'import { MapPin, User');
}

fs.writeFileSync('frontend/frontend/src/components/client/ClientPortal.jsx', code);
