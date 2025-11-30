import sys
import json
import random
from ytmusicapi import YTMusic

# Initialize YTMusic
yt = YTMusic()

def recommend(user_id, context, recent_history, limit=20):
    # print(f"Generating recommendations for user {user_id} with context {context}", file=sys.stderr)
    
    candidates = []
    
    # 1. Candidate Generation
    # A. From Recent History (Up Next)
    if recent_history:
        last_track_id = recent_history[0]
        try:
            up_next = yt.get_watch_playlist(videoId=last_track_id, limit=20)
            if 'tracks' in up_next:
                candidates.extend(up_next['tracks'])
        except Exception as e:
            # print(f"Error fetching up next: {e}", file=sys.stderr)
            pass

    # B. From Context (Search) - Placeholder
    
    # 2. Filtering
    # Remove duplicates and already played songs
    unique_candidates = {}
    for track in candidates:
        if track['videoId'] not in recent_history and track['videoId'] not in unique_candidates:
            unique_candidates[track['videoId']] = track
            
    final_candidates = list(unique_candidates.values())
    
    # 3. Ranking (Heuristic for now)
    random.shuffle(final_candidates)
    
    # Format for response
    recommendations = []
    for track in final_candidates[:limit]:
        recommendations.append({
            "pipedId": track['videoId'],
            "title": track['title'],
            "thumbnail": track['thumbnail'][0]['url'] if track.get('thumbnail') else '',
            "uploaderName": track['artists'][0]['name'] if track.get('artists') else 'Unknown',
            "duration": track.get('length_seconds', 0)
        })
        
    return recommendations

if __name__ == "__main__":
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        request = json.loads(input_data)
        
        user_id = request.get("userId", "anonymous")
        context = request.get("context", "radio")
        recent_history = request.get("recentHistory", [])
        limit = request.get("limit", 20)
        
        recs = recommend(user_id, context, recent_history, limit)
        
        # Print result to stdout
        print(json.dumps({"recommendations": recs}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
