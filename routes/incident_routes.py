from flask import Blueprint, jsonify, request
from models import db, Leak, Session, SessionTab, IncidentCorrelation
from utils import correlate_leak_to_session

incident_bp = Blueprint("incident", __name__)


@incident_bp.route("/correlate-incident", methods=["POST"])
def correlate_incident():
    try:
        data = request.get_json()
        if not data or "leak_id" not in data:
            return jsonify({"error": "leak_id is required"}), 400

        leak = Leak.query.get(data["leak_id"])
        if not leak:
            return jsonify({"error": "Leak not found"}), 404

        user_id = leak.alias.user_id if leak.alias else None
        if not user_id:
            return jsonify({"error": "Cannot determine user from leak"}), 400

        sessions = Session.query.filter_by(user_id=user_id).all()
        correlations = []
        best_correlation = None
        highest_confidence = 0.0

        for session in sessions:
            tabs = SessionTab.query.filter_by(session_id=session.id).all()
            session_data = {
                "id": session.id,
                "start_time": session.start_time,
                "tabs": [{"url": tab.url} for tab in tabs]
            }

            alias_data = {
                "id": leak.alias.id,
                "alias_email": leak.alias.alias_email
            } if leak.alias_id else None

            correlation_result = correlate_leak_to_session(
                {"breach_source": leak.breach_source, "detected_at": leak.detected_at},
                session_data,
                alias_data
            )

            correlation = IncidentCorrelation(
                leak_id=leak.id,
                session_id=session.id,
                alias_id=leak.alias_id,
                correlation_confidence=correlation_result["confidence"],
                correlation_factors=correlation_result["factors"]
            )

            db.session.add(correlation)
            correlations.append({
                "session_id": session.id,
                "confidence": correlation_result["confidence"],
                "factors": correlation_result["factors"]
            })

            if correlation_result["confidence"] > highest_confidence:
                highest_confidence = correlation_result["confidence"]
                best_correlation = correlation

        db.session.commit()

        return jsonify({
            "message": "Incident correlation completed",
            "leak_id": leak.id,
            "correlations": correlations,
            "best_correlation": {
                "session_id": best_correlation.session_id if best_correlation else None,
                "confidence": highest_confidence,
            }
        }), 200

    except Exception as e:
        print(f"[ERROR] correlate_incident(): {e}")
        return jsonify({"error": str(e)}), 500


@incident_bp.route("/incident-correlations", methods=["GET"])
def get_incident_correlations():
    leak_id = request.args.get("leak_id")
    session_id = request.args.get("session_id")

    query = IncidentCorrelation.query
    if leak_id:
        query = query.filter_by(leak_id=leak_id)
    if session_id:
        query = query.filter_by(session_id=session_id)

    correlations = query.all()

    return jsonify([
        {
            "id": c.id,
            "leak_id": c.leak_id,
            "session_id": c.session_id,
            "alias_id": c.alias_id,
            "correlation_confidence": c.correlation_confidence,
            "correlation_factors": c.correlation_factors,
            "correlated_at": c.correlated_at.isoformat() if c.correlated_at else None,
            "is_resolved": c.is_resolved,
            "resolution_notes": c.resolution_notes,
        }
        for c in correlations
    ]), 200


@incident_bp.route("/incident-correlations/<int:correlation_id>", methods=["PUT"])
def resolve_incident_correlation(correlation_id):
    correlation = IncidentCorrelation.query.get_or_404(correlation_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    correlation.is_resolved = data.get("is_resolved", False)
    correlation.resolution_notes = data.get("resolution_notes")
    db.session.commit()

    return jsonify({"message": "Incident correlation updated successfully"}), 200
