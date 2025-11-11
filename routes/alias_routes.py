import secrets
from flask import Blueprint, jsonify, request
from models import db, Alias, User
from utils import generate_random_password

alias_bp = Blueprint("alias", __name__)

@alias_bp.route("/aliases", methods=["GET", "POST"])
def manage_aliases():
    if request.method == "POST":
        data = request.get_json()
        if not data or "user_id" not in data or "domain" not in data:
            return jsonify({"error": "user_id and domain/email/tag are required"}), 400

        user = User.query.get(data["user_id"])
        if not user:
            return jsonify({"error": "Invalid user_id"}), 400

        input_value = data["domain"].strip().lower()
        candidate = ""  # This will store the final alias email

        if not input_value:
             return jsonify({"error": "Input value cannot be empty"}), 400

        if "@" in input_value:
            # --- SCENARIO 1: A full email address was provided ---
            # e.g., "my.custom@example.com" OR "sambhav242005+github@gmail.com"
            candidate = input_value
        
        elif "." in input_value:
            # --- SCENARIO 2: Only a domain was provided ---
            # e.g., "example.com" or "google.com"
            domain = input_value
            for _ in range(5):
                candidate = f"{secrets.token_hex(8)}@{domain}"
                if not Alias.query.filter_by(alias_email=candidate).first():
                    break
            else:
                return jsonify({"error": "Unable to generate unique alias"}), 500
        
        else:
            # --- SCENARIO 3: A tag was provided ---
            # e.g., "github", "netflix", "shopping"
            if not user.email or "@" not in user.email:
                # This requires the user.email field to be set in your User model!
                return jsonify({"error": "User has no base email for tagging"}), 400
            
            tag = input_value
            # Split base email (e.g., "sambhav242005@gmail.com")
            local_part, domain_part = user.email.split("@", 1)
            # Create the +alias (e.g., "sambhav242005+github@gmail.com")
            candidate = f"{local_part}+{tag}@{domain_part}"

        # --- Check for Duplicates ---
        # This check now covers all three scenarios
        if Alias.query.filter_by(alias_email=candidate).first():
            return jsonify({"error": "This email alias is already taken"}), 409 # 409 Conflict

        # --- Create the alias ---
        alias = Alias(
            user_id=user.id,
            alias_email=candidate,
            generated_password=generate_random_password(),
            site_name=data.get("site_name"),
            group_name=data.get("group_name"),
        )
        db.session.add(alias)
        db.session.commit()

        return jsonify({
            "alias_id": alias.id,
            "alias_email": alias.alias_email,
            "generated_password": alias.generated_password
        }), 201

    # --- GET (List) ---
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    aliases = Alias.query.filter_by(user_id=user_id).all()
    return jsonify([
        {
            "id": a.id,
            "alias_email": a.alias_email,
            "site_name": a.site_name,
            "generated_password": a.generated_password,
            "group_name": a.group_name,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in aliases
    ])

@alias_bp.route("/aliases/<int:alias_id>", methods=["GET", "PUT", "DELETE"])
def manage_single_alias(alias_id):
    # Get the specific alias by its ID, or return 404 Not Found if it doesn't exist
    alias = Alias.query.get_or_404(alias_id)

    # --- GET (Single Item) ---
    if request.method == "GET":
        return jsonify({
            "id": alias.id,
            "alias_email": alias.alias_email,
            "generated_password": alias.generated_password, # Included for single-item retrieve
            "site_name": alias.site_name,
            "group_name": alias.group_name,
            "created_at": alias.created_at.isoformat() if alias.created_at else None
        })

    # --- PUT (Update) ---
    if request.method == "PUT":
        data = request.get_json()
        if not data:
            return jsonify({"error": "No update data provided"}), 400

        if "site_name" in data:
            alias.site_name = data["site_name"]
        if "group_name" in data:
            alias.group_name = data["group_name"]

        db.session.commit()
        return jsonify({"message": "Alias updated successfully", "id": alias.id}), 200

    # --- DELETE ---
    if request.method == "DELETE":
        db.session.delete(alias)
        db.session.commit()
        return jsonify({"message": "Alias deleted successfully"}), 200
    
    return jsonify({"error": "Method Not Allowed"}), 405