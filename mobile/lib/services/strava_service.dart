import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Strava Integration Service
///
/// Handles OAuth token refreshing and uploading compiled GPX 1.1 activities
/// with Garmin TrackPointExtensions directly to the Strava Upload API v3.
class StravaService {
  static final StravaService instance = StravaService._init();
  StravaService._init();

  static const String _stravaApiBase = 'https://www.strava.com/api/v3';

  /// Uploads compiled GPX string to Strava
  Future<Map<String, dynamic>> uploadActivity({
    required String accessToken,
    required String gpxContent,
    required String activityName,
    String? description,
    String activityType = 'hike',
  }) async {
    final uri = Uri.parse('$_stravaApiBase/uploads');
    final request = http.MultipartRequest('POST', uri);

    request.headers['Authorization'] = 'Bearer $accessToken';
    request.fields['data_type'] = 'gpx';
    request.fields['name'] = activityName;
    request.fields['activity_type'] = activityType;
    if (description != null) {
      request.fields['description'] = description;
    }

    request.files.add(
      http.MultipartFile.fromString(
        'file',
        gpxContent,
        filename: 'trek_${DateTime.now().millisecondsSinceEpoch}.gpx',
      ),
    );

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception('Strava upload failed [${response.statusCode}]: ${response.body}');
    }
  }

  /// Refreshes OAuth2 access token
  Future<String> refreshAccessToken({
    required String clientId,
    required String clientSecret,
    required String refreshToken,
  }) async {
    final uri = Uri.parse('https://www.strava.com/oauth/token');
    final res = await http.post(uri, body: {
      'client_id': clientId,
      'client_secret': clientSecret,
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken,
    });

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      return data['access_token'] as String;
    } else {
      throw Exception('Strava token refresh failed: ${res.body}');
    }
  }
}
