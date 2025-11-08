from flask import Blueprint, jsonify, request
from utils import classify_behavior, write_to_csv, sort_emails, summarize_incident

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/agentic-monitor", methods=["POST"])
def monitor_tabs():
    data = request.get_json()
    required = {"url", "actions", "api_calls"}

    if not data or not required.issubset(data):
        return jsonify({"error": f"Missing fields: {required - set(data or {})}"}), 400

    prompt = f"URL: {data['url']}\nActions: {data['actions']}\nAPI Calls: {data['api_calls']}"
    classification = classify_behavior(prompt)
    recommendation = "ALLOW" if classification == "GOOD" else "BLOCK"

    return jsonify({
        "classification": classification,
        "recommendation": recommendation
    }), 200


@ai_bp.route("/log-choice", methods=["POST"])
def log_user_choice():
    """
    Receives JSON with keys: user_id, session_id, choice, features
    Writes a line to CSV via write_to_csv.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No JSON provided"}), 400

        required = {"user_id", "session_id", "choice"}
        if not required.issubset(data):
            return jsonify({
                "status": "error",
                "message": f"Missing fields: {required - set(data.keys())}"
            }), 400

        write_to_csv(data)
        return jsonify({"status": "success", "logged_entry": data}), 200

    except Exception as e:
        print(f"[ERROR] log_user_choice(): {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@ai_bp.route("/email-sort", methods=["POST"])
def sort_email():
    data = request.get_json()
    if not data or "email_content" not in data:
        return jsonify({"error": "email_content is required"}), 400

    category = sort_emails(data["email_content"])
    return jsonify(category), 200


@ai_bp.route("/incident-summary", methods=["POST"])
def get_summary():
    data = request.get_json()
    if not data or "incident_details" not in data:
        return jsonify({"error": "incident_details is required"}), 400

    summary = summarize_incident(data["incident_details"])
    return jsonify({"summary": summary}), 200
