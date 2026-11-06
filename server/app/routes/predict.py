"""
Severity Prediction Route Handler
"""

from fastapi import APIRouter, HTTPException
from server.app.schemas.prediction import (
    SeverityPredictionRequest,
    SeverityPredictionResponse
)
from server.app.services.prediction_service import PredictionService

router = APIRouter(prefix="/predict", tags=["Prediction"])

@router.post("/severity", response_model=SeverityPredictionResponse)
def predict_accident_severity(request: SeverityPredictionRequest):
    """
    Predicts accident traffic delay severity (Scale 1-4) using the trained
    Random Forest pipeline with Scikit-learn ColumnTransformer.
    """
    ps = PredictionService.get_instance()
    try:
        result = ps.predict(request.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failure: {str(e)}")

