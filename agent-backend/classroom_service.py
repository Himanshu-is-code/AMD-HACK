import os
from googleapiclient.discovery import build
import auth_service
import logging

def get_service():
    """Builds and returns the Google Classroom API service."""
    creds = auth_service.get_credentials()
    if not creds:
         return {"error": "Not authenticated. Please connect your Google account."}
    try:
         service = build('classroom', 'v1', credentials=creds)
         return service
    except Exception as e:
         return {"error": f"Failed to build Classroom service: {str(e)}"}

def list_courses(limit=10):
    """Retrieves the user's active courses."""
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service
    try:
        results = service.courses().list(pageSize=limit, courseStates=['ACTIVE']).execute()
        courses = results.get('courses', [])
        return {"courses": courses}
    except Exception as e:
        logging.error(f"Classroom API Error (list_courses): {e}")
        return {"error": str(e)}

def list_coursework(course_id, limit=20):
    """Retrieves coursework/assignments for a specific course."""
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service
    try:
        results = service.courses().courseWork().list(courseId=course_id, pageSize=limit).execute()
        coursework = results.get('courseWork', [])
        return {"courseWork": coursework}
    except Exception as e:
        logging.error(f"Classroom API Error (list_coursework): {e}")
        return {"error": str(e)}

def list_announcements(course_id, limit=10):
    """Retrieves announcements for a specific course."""
    service = get_service()
    if isinstance(service, dict) and "error" in service:
        return service
    try:
        results = service.courses().announcements().list(courseId=course_id, pageSize=limit).execute()
        announcements = results.get('announcements', [])
        return {"announcements": announcements}
    except Exception as e:
        logging.error(f"Classroom API Error (list_announcements): {e}")
        return {"error": str(e)}
