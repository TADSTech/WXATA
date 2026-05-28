import re
import os

dash_path = 'c:/Users/TADS/WORK/TADSTech/WXATA/frontend/src/pages/Dashboard.tsx'
tv_path = 'c:/Users/TADS/WORK/TADSTech/WXATA/frontend/src/pages/TvDashboard.tsx'

with open(dash_path, 'r', encoding='utf-8') as f:
    dash_content = f.read()

with open(tv_path, 'r', encoding='utf-8') as f:
    tv_content = f.read()

# Make TvDashboard.tsx
tv_content = tv_content.replace('const Dashboard = () => {', 'const TvDashboard = () => {')
tv_content = tv_content.replace('export default Dashboard;', 'export default TvDashboard;')
tv_content = tv_content.replace('WXATA_DASHBOARD v1.0.0', 'WXATA_TV_DASHBOARD v1.0.0')

# In TvDashboard, remove ScriptManager, PermissionsEditor, WelcomeEditor, MiniMarketplace usages
# from the render part.
tv_render_start = tv_content.find('{botInfo.tvMode ? (')
tv_render_end = tv_content.find('          {/* Quick Actions */}')
if tv_render_start != -1 and tv_render_end != -1:
    tv_replacement = """
          <TVConfigEditor
            tvConfig={botInfo.tvConfig}
            onChange={c => { setBotInfo(prev => ({ ...prev, tvConfig: c })); setConfigStatus('Unsaved changes'); }}
            onSave={saveBotInfo}
          />
          <TVCommandsReference prefix={botInfo.prefix} />
          <TwitterGrabber />
"""
    tv_content = tv_content[:tv_render_start] + tv_replacement + tv_content[tv_render_end:]

with open(tv_path, 'w', encoding='utf-8') as f:
    f.write(tv_content)

# In Dashboard.tsx, remove TVConfigEditor, TVCommandsReference, TwitterGrabber definitions
dash_content = re.sub(r'// ─── TVConfigEditor ──────────────────────────────────────────────────────────.*?// ─── WelcomeEditor ────────────────────────────────────────────────────────────', r'// ─── WelcomeEditor ────────────────────────────────────────────────────────────', dash_content, flags=re.DOTALL)

# In Dashboard.tsx, update the render part
dash_render_start = dash_content.find('{botInfo.tvMode ? (')
dash_render_end = dash_content.find('              {/* Script Manager */}')
if dash_render_start != -1 and dash_render_end != -1:
    dash_replacement = """
          {botInfo.tvMode && (
            <div className="bg-accent-subtle/20 border border-accent-subtle p-4 rounded text-accent-light space-y-3">
              <div className="font-bold uppercase tracking-widest text-xs">TV Mode Active</div>
              <p className="text-xs">Your TV Mode dashboard is active for this account. Standard bot commands are disabled for non-root users.</p>
              <button
                onClick={() => navigate(`/tv/${username}`)}
                className="w-full border border-accent-primary bg-accent-primary hover:bg-accent-hover text-bg-base px-4 py-2 text-xs font-bold transition-colors uppercase tracking-widest"
              >
                Go to TV Dashboard
              </button>
            </div>
          )}

          <div className={botInfo.tvMode ? "opacity-50 pointer-events-none" : ""}>
"""
    dash_content = dash_content[:dash_render_start] + dash_replacement + dash_content[dash_render_end:]
    # Now we need to close the div for the opacity
    dash_render_end2 = dash_content.find('          {/* Quick Actions */}')
    dash_content = dash_content[:dash_render_end2] + '          </div>\n\n' + dash_content[dash_render_end2:]

with open(dash_path, 'w', encoding='utf-8') as f:
    f.write(dash_content)

print('Refactor complete')
