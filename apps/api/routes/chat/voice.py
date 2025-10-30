"""
Voice turn endpoint for audio-based interactions.
"""

import logging

from fastapi import APIRouter, HTTPException, Depends, Request

from apps.api.routes.deps import get_current_user_with_collection_access, get_chat_service

from .models import VoiceTurnRequest, VoiceTurnResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/voice-turn", response_model=VoiceTurnResponse)
async def voice_turn_endpoint(
    request: Request,
    voice_request: VoiceTurnRequest,
    current_user=Depends(get_current_user_with_collection_access),
    chat_service=Depends(get_chat_service),
):
    """
    Turn-based voice endpoint that handles audio transcription, agent reasoning,
    and optional TTS synthesis.
    """
    try:
        # Use ChatService for all business logic
        response = await chat_service.send_message(
            user=current_user,
            audio_b64=voice_request.audio_b64,
            sample_rate=voice_request.sample_rate,
            session_id=voice_request.session_id or "default",
            messages=voice_request.messages,
            model=voice_request.model,
            enable_tools=voice_request.enable_tools,
            expect_audio=voice_request.expect_audio,
        )

        return VoiceTurnResponse(
            transcript=response.transcript or "",
            assistant_text=response.content,
            metadata=response.metadata,
            audio_b64=response.audio_b64,
            audio_sample_rate=response.audio_sample_rate,
            stt_confidence=response.stt_confidence,
            stt_language=response.stt_language,
            tool_events=response.tool_events,
            logs=response.logs,
        )

    except ValueError as e:
        # Handle input validation errors
        error_msg = str(e)
        if "Invalid" in error_msg or "base64" in error_msg:
            raise HTTPException(status_code=400, detail="Invalid audio payload")
        elif "empty" in error_msg:
            raise HTTPException(status_code=400, detail="Transcription produced empty text")
        else:
            raise HTTPException(status_code=400, detail=error_msg)

    except RuntimeError as e:
        # Handle transcription service errors
        raise HTTPException(status_code=503, detail=str(e))

    except Exception as e:
        # Handle unexpected errors
        logger.error(
            "Voice turn endpoint error",
            extra={"error": str(e), "error_type": type(e).__name__},
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Voice processing failed")
