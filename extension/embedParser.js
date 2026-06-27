// Standalone embed parser (no vscode dependency)

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

module.exports = { parseEmbed, generateEmbed, esc };
