from flask import Blueprint, jsonify, request
from models import db, Leak, BreachReport, BreachStatus,BreachAction
from utils import check_email_breach

breach_bp = Blueprint("breach", __name__)

@breach_bp.route("/leak-check", methods=["POST"])
def check_leak():
    try:
        data = request.get_json(silent=True)
        if not data or "email" not in data:
            return jsonify({"error": "Email is required"}), 400

        email = data["email"].strip().lower()
        alias_id = data.get("alias_id")

        result = check_email_breach(email)
        if not result:
            return jsonify({"status": "ERROR", "message": "Unable to check breach status"}), 500

        if result.get("found") and result.get("breach_count", 0) > 0:
            details = result["breaches"]

            if alias_id:
                try:
                    names = [b.get("Name", "unknown") for b in details]
                    source = ", ".join(names[:3])
                    leak = Leak(alias_id=alias_id, breach_source=source)
                    db.session.add(leak)
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    print(f"[DB ERROR] {e}")

            report = BreachReport(
                status=BreachStatus.COMPROMISED,
                action=BreachAction.REPLACE_PASSWORD,
                breach_count=result["breach_count"],
                breaches=[b.get("Name", "") for b in details],
                details=details
            )

            return jsonify(report.dict()), 200

        return jsonify({"status": "SAFE", "message": "No breaches found"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] check_leak: {e}")
        return jsonify({"status": "ERROR", "message": str(e)}), 500
