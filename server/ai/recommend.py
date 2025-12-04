import sys
import json
import random
from ytmusicapi import YTMusic

# Initialize YTMusic
yt = YTMusic()

def recommend(user_id, context, recent_history, liked_tracks=[], top_artists=[], limit=20):
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
    
    # B. From Top Artists (Discovery)
    if top_artists and len(candidates) < limit * 2:
        try:
            # Pick a random top artist to explore
            seed_artist = random.choice(top_artists)
            # Search for songs by them or similar
            search_results = yt.search(f"Songs similar to {seed_artist}", filter="songs", limit=10)
            candidates.extend(search_results)
        except Exception:
            pass

    # 2. Filtering & Ranking
    unique_candidates = {}
    for track in candidates:
        vid = track.get('videoId')
        if not vid: continue
        
        # Skip if recently played
        if vid in recent_history:
            continue
            
        # Score the track
        score = 0
        
        # Boost if from a top artist
        artist_name = track['artists'][0]['name'] if track.get('artists') else ''
        if artist_name in top_artists:
            score += 5
            
        # Boost if previously liked (familiarity)
        if vid in liked_tracks:
            score += 3
            
        # Store with score
        if vid not in unique_candidates:
            track['score'] = score
            unique_candidates[vid] = track
            
    final_candidates = list(unique_candidates.values())
    
    # Sort by score desc, then random
    final_candidates.sort(key=lambda x: x['score'] + random.random(), reverse=True)
    
    # Helper to parse duration
    def parse_duration(d):
        if isinstance(d, int):
            return d
        if isinstance(d, str):
            parts = d.split(':')
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return 0

    # Format for response
    recommendations = []
    for track in final_candidates[:limit]:
        # Try multiple keys for duration
        duration = track.get('length_seconds')
        if not duration:
            duration = track.get('duration')
        if not duration:
            duration = track.get('length')
            
        recommendations.append({
            "pipedId": track['videoId'],
            "title": track['title'],
            "thumbnail": track['thumbnail'][0]['url'] if track.get('thumbnail') else '',
            "uploaderName": track['artists'][0]['name'] if track.get('artists') else 'Unknown',
            "duration": parse_duration(duration)
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
        liked_tracks = request.get("likedTracks", [])
        top_artists = request.get("topArtists", [])
        limit = request.get("limit", 20)
        
        recs = recommend(user_id, context, recent_history, liked_tracks, top_artists, limit)
        
        # Print result to stdout
        print(json.dumps({"recommendations": recs}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
