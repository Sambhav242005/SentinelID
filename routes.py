import secrets
from flask import Blueprint, jsonify, request
from models import db, User, Alias, Leak, Session, SessionTab
from utils import (
    generate_random_password,
    classify_behavior,
    sort_emails,
    summarize_incident,
    check_email_breach,
)

main_blueprint = Blueprint("main", __name__)


@main_blueprint.route("/register", methods=["POST"])
def register():
    data = request.json

    # Check if user already exists
    existing_user = User.query.filter_by(email=data["email"]).first()
    if existing_user:
        return jsonify({"error": "User with this email already exists"}), 400

    new_user = User(
        username=data["username"],
        email=data["email"],
        password_hash=data["password"],  # In prod: hash with bcrypt!
    )
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered!", "user_id": new_user.id}), 201


@main_blueprint.route("/aliases", methods=["GET", "POST"])
def manage_aliases():
    if request.method == "POST":
        data = request.json
        new_alias = Alias(
            user_id=data["user_id"],
            alias_email=f"{secrets.token_hex(8)}@{data['domain']}",  # Now works
            generated_password=generate_random_password(),
            site_name=data.get("site_name"),
            group_name=data.get("group_name"),
        )
        db.session.add(new_alias)
        db.session.commit()
        return jsonify(
            {
                "alias_email": new_alias.alias_email,
                "generated_password": new_alias.generated_password,
            }
        ), 201

    params = {"user_id": request.args.get("user_id")}
    aliases = Alias.query.filter_by(user_id=params["user_id"]).all()
    return jsonify(
        [
            {
                "id": a.id,
                "alias_email": a.alias_email,
                "site_name": a.site_name,
                "group_name": a.group_name,
            }
            for a in aliases
        ]
    )


@main_blueprint.route("/leak-check", methods=["POST"])
def check_leak():
    try:
        data = request.json

        # Validate input
        if not data or "email" not in data:
            return jsonify({"error": "Email is required"}), 400

        email = data["email"]
        alias_id = data.get("alias_id")  # Optional, may not always be present

        # Check email against HIBP
        result = check_email_breach(email)

        if result is None:
            return jsonify(
                {"status": "ERROR", "message": "Unable to check breach status"}
            ), 500

        # If breaches found
        if result["found"] and result["breach_count"] > 0:
            # Log the breach to database if alias_id provided
            if alias_id:
                try:
                    breach_names = [breach["Name"] for breach in result["breaches"]]
                    breach_source = ", ".join(breach_names[:3])  # First 3 breaches

                    new_leak = Leak(alias_id=alias_id, breach_source=breach_source)
                    db.session.add(new_leak)
                    db.session.commit()
                except Exception as db_error:
                    print(f"Database error: {db_error}")
                    db.session.rollback()

            return jsonify(
                {
                    "status": "COMPROMISED",
                    "action": "replace_password",
                    "breach_count": result["breach_count"],
                    "breaches": [breach["Name"] for breach in result["breaches"]],
                    "details": result["breaches"],
                }
            ), 200

        # Email is safe
        return jsonify(
            {"status": "SAFE", "message": "No breaches found for this email"}
        ), 200

    except Exception as e:
        print(f"Error in check_leak: {e}")
        return jsonify({"status": "ERROR", "message": str(e)}), 500


@main_blueprint.route("/sessions/start", methods=["POST"])
def start_session():
    data = request.json
    new_session = Session(user_id=data["user_id"])
    db.session.add(new_session)
    db.session.commit()
    return jsonify({"session_id": new_session.id}), 201


@main_blueprint.route("/sessions/<int:session_id>/tabs", methods=["POST"])
def add_tab(session_id):
    data = request.json
    new_tab = SessionTab(
        session_id=session_id,
        url=data["url"],
        cookies=data.get("cookies"),
        local_storage=data.get("local_storage"),
    )
    db.session.add(new_tab)
    db.session.commit()
    return jsonify({"tab_id": new_tab.id}), 201


@main_blueprint.route("/sessions/<int:session_id>/destroy", methods=["DELETE"])
def destroy_session(session_id):
    session = Session.query.get_or_404(session_id)
    session.active = False
    SessionTab.query.filter_by(session_id=session_id).delete()
    db.session.commit()
    return jsonify({"message": "Session destroyed"}), 200


# AI-Powered Endpoints
@main_blueprint.route("/agentic-monitor", methods=["POST"])
def monitor_tabs():
    data = request.json
    behavior_prompt = f"URL: {data['url']}\nActions: {data['actions']}\nAPI Calls: {data['api_calls']}"
    classification = classify_behavior(behavior_prompt)
    return jsonify(
        {
            "classification": classification,
            "recommendation": "ALLOW" if classification == "GOOD" else "BLOCK",
        }
    )


@main_blueprint.route("/email-sort", methods=["POST"])
def sort_email():
    data = request.json
    category = sort_emails(data["email_content"])
    return jsonify(category)


@main_blueprint.route("/incident-summary", methods=["POST"])
def get_summary():
    data = request.json
    summary = summarize_incident(data["incident_details"])
    return jsonify({"summary": summary})
