// Validates the playroom query parameter against PLAYROOM_KEY env var
// Rejects all requests without a valid playroom param to prevent unauthorized access
function validatePlayroom(request) {
  const playroom = request.query.get("playroom");
  const expectedPlayroom = process.env.PLAYROOM_KEY;
  if (!expectedPlayroom) return true; // If not configured, allow all (local dev)
  if (!playroom) return false; // Reject missing playroom param
  return playroom === expectedPlayroom;
}

function playroomDenied() {
  return { status: 403, jsonBody: { error: "Invalid or missing playroom key" } };
}

module.exports = { validatePlayroom, playroomDenied };
