class TrailWaypoint {
  final String name;
  final String type; // 'start', 'campsite', 'water', 'campsite_water', 'pass', 'summit'
  final double lat;
  final double lon;

  const TrailWaypoint({
    required this.name,
    required this.type,
    required this.lat,
    required this.lon,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'type': type,
    'lat': lat,
    'lon': lon,
  };

  factory TrailWaypoint.fromJson(Map<String, dynamic> json) => TrailWaypoint(
    name: json['name'] as String,
    type: json['type'] as String,
    lat: (json['lat'] as num).toDouble(),
    lon: (json['lon'] as num).toDouble(),
  );
}

class TrailModel {
  final String id;
  final String name;
  final String state;
  final String region;
  final String soiSheet;
  final String difficulty;
  final double distanceKm;
  final double maxAltM;
  final String duration;
  final String description;
  final List<List<double>> routeCoords; // [[lat, lon, ele], ...]
  final List<TrailWaypoint> waypoints;

  const TrailModel({
    required this.id,
    required this.name,
    required this.state,
    required this.region,
    required this.soiSheet,
    required this.difficulty,
    required this.distanceKm,
    required this.maxAltM,
    required this.duration,
    required this.description,
    required this.routeCoords,
    required this.waypoints,
  });

  double get startLat => routeCoords.first[0];
  double get startLon => routeCoords.first[1];
  double get minAltM => routeCoords.map((c) => c[2]).reduce((a, b) => a < b ? a : b);
  double get elevationGainM => maxAltM - minAltM;
}

/// Official Seeded Indian Trekking Dataset (10 Iconic Treks)
class SeededTrailsData {
  static const List<TrailModel> trails = [
    TrailModel(
      id: "kedarkantha",
      name: "Kedarkantha Summit Trek",
      state: "Uttarakhand",
      region: "Himalayas",
      soiSheet: "53J/1",
      difficulty: "Moderate",
      distanceKm: 20.0,
      maxAltM: 3810,
      duration: "4 Days",
      description: "Classic Garhwal snow trek through pine forests to a 360° summit panoramic view of Swargarohini, Bandarpoonch, and Black Peak.",
      routeCoords: [
        [31.0772, 78.1831, 1950],
        [31.0665, 78.1982, 2770],
        [31.0460, 78.2045, 3430],
        [31.0238, 78.1722, 3810],
      ],
      waypoints: [
        TrailWaypoint(name: "Sankri Trailhead", type: "start", lat: 31.0772, lon: 78.1831),
        TrailWaypoint(name: "Juda Ka Talab", type: "campsite_water", lat: 31.0665, lon: 78.1982),
        TrailWaypoint(name: "Kedarkantha Base", type: "campsite", lat: 31.0460, lon: 78.2045),
        TrailWaypoint(name: "Kedarkantha Peak", type: "summit", lat: 31.0238, lon: 78.1722),
      ],
    ),
    TrailModel(
      id: "hampta_pass",
      name: "Hampta Pass Crossover",
      state: "Himachal Pradesh",
      region: "Himalayas",
      soiSheet: "52H/8",
      difficulty: "Moderate-Hard",
      distanceKm: 26.0,
      maxAltM: 4270,
      duration: "5 Days",
      description: "Dramatic crossover from the lush green Kullu Valley into the stark alpine desert of Lahaul and Spiti.",
      routeCoords: [
        [32.2195, 77.2223, 2980],
        [32.2380, 77.2690, 3100],
        [32.2610, 77.3110, 3620],
        [32.2815, 77.3490, 4270],
        [32.3120, 77.3680, 3960],
      ],
      waypoints: [
        TrailWaypoint(name: "Jobra", type: "start", lat: 32.2195, lon: 77.2223),
        TrailWaypoint(name: "Jwara River Meadow", type: "water", lat: 32.2380, lon: 77.2690),
        TrailWaypoint(name: "Balu Ka Ghera", type: "campsite", lat: 32.2610, lon: 77.3110),
        TrailWaypoint(name: "Hampta Pass", type: "pass", lat: 32.2815, lon: 77.3490),
        TrailWaypoint(name: "Shea Goru", type: "campsite_water", lat: 32.3120, lon: 77.3680),
      ],
    ),
    TrailModel(
      id: "dzukou_valley",
      name: "Dzukou Valley & Japfu Ridge",
      state: "Nagaland / Manipur",
      region: "North-East",
      soiSheet: "83K/2",
      difficulty: "Moderate",
      distanceKm: 17.5,
      maxAltM: 2690,
      duration: "3 Days",
      description: "Emerald undulating dwarf-bamboo rolling meadows, rare endemic Dzukou lilies, and pristine crystalline river streams.",
      routeCoords: [
        [25.5680, 94.1160, 1850],
        [25.5540, 94.0920, 2610],
        [25.5582, 94.0736, 2452],
        [25.5410, 94.0650, 2430],
      ],
      waypoints: [
        TrailWaypoint(name: "Viswema Point", type: "start", lat: 25.5680, lon: 94.1160),
        TrailWaypoint(name: "Dzukou Rest House", type: "campsite", lat: 25.5582, lon: 94.0736),
        TrailWaypoint(name: "Dzukou Helipad & Stream", type: "water", lat: 25.5410, lon: 94.0650),
      ],
    ),
    TrailModel(
      id: "sandakphu",
      name: "Sandakphu - Phalut Ridge",
      state: "West Bengal / Sikkim",
      region: "Himalayas",
      soiSheet: "78A/4",
      difficulty: "Moderate",
      distanceKm: 51.0,
      maxAltM: 3636,
      duration: "6 Days",
      description: "Walk the border line of India and Nepal on the Singalila Ridge with uninterrupted views of Everest, Lhotse, Makalu, and Kanchenjunga.",
      routeCoords: [
        [26.9890, 88.1200, 2134],
        [27.0310, 88.0680, 3070],
        [27.0540, 88.0310, 2621],
        [27.1059, 88.0016, 3636],
        [27.2111, 88.0190, 3600],
      ],
      waypoints: [
        TrailWaypoint(name: "Manebhanjan", type: "start", lat: 26.9890, lon: 88.1200),
        TrailWaypoint(name: "Tumling", type: "campsite", lat: 27.0310, lon: 88.0680),
        TrailWaypoint(name: "Kalipokhri Lake", type: "water", lat: 27.0780, lon: 88.0150),
        TrailWaypoint(name: "Sandakphu Peak", type: "summit", lat: 27.1059, lon: 88.0016),
      ],
    ),
    TrailModel(
      id: "valley_of_flowers",
      name: "Valley of Flowers & Hemkund Sahib",
      state: "Uttarakhand",
      region: "Himalayas",
      soiSheet: "53N/10",
      difficulty: "Moderate",
      distanceKm: 38.0,
      maxAltM: 4329,
      duration: "4 Days",
      description: "UNESCO World Heritage biosphere carpeted with hundreds of wild Himalayan alpine flowers beside glacial Hemkund Lake.",
      routeCoords: [
        [30.6250, 79.5630, 1828],
        [30.7010, 79.5930, 3048],
        [30.7280, 79.6053, 3658],
        [30.7003, 79.6152, 4329],
      ],
      waypoints: [
        TrailWaypoint(name: "Govindghat", type: "start", lat: 30.6250, lon: 79.5630),
        TrailWaypoint(name: "Ghangaria Base", type: "campsite_water", lat: 30.7010, lon: 79.5930),
        TrailWaypoint(name: "Valley of Flowers Core", type: "summit", lat: 30.7280, lon: 79.6053),
        TrailWaypoint(name: "Hemkund Glacial Lake", type: "water", lat: 30.7003, lon: 79.6152),
      ],
    ),
    TrailModel(
      id: "kashmir_great_lakes",
      name: "Kashmir Great Lakes",
      state: "Jammu & Kashmir",
      region: "Himalayas",
      soiSheet: "43N/3",
      difficulty: "Hard",
      distanceKm: 72.0,
      maxAltM: 4191,
      duration: "7 Days",
      description: "Seven high-altitude alpine oligotrophic lakes surrounded by soaring snow peaks, alpine meadows, and silver birch forests.",
      routeCoords: [
        [34.3030, 75.2670, 2740],
        [34.3650, 75.2110, 3570],
        [34.3980, 75.1520, 4191],
        [34.4150, 75.0890, 3650],
        [34.3520, 74.9820, 3580],
      ],
      waypoints: [
        TrailWaypoint(name: "Shitkadi Sonamarg", type: "start", lat: 34.3030, lon: 75.2670),
        TrailWaypoint(name: "Vishansar Lake", type: "campsite_water", lat: 34.3950, lon: 75.1950),
        TrailWaypoint(name: "Gadsar Pass", type: "pass", lat: 34.3980, lon: 75.1520),
        TrailWaypoint(name: "Gangabal Twin Lakes", type: "campsite_water", lat: 34.4320, lon: 74.9450),
      ],
    ),
    TrailModel(
      id: "rajmachi",
      name: "Rajmachi & Kondhane Caves Trail",
      state: "Maharashtra",
      region: "Western Ghats",
      soiSheet: "47F/5",
      difficulty: "Easy-Moderate",
      distanceKm: 16.0,
      maxAltM: 826,
      duration: "2 Days",
      description: "Lush Sahyadri monsoon trail passing ancient 1st-century Buddhist Kondhane rock-cut caves to the twin forts of Shrivardhan and Manaranjan.",
      routeCoords: [
        [18.7550, 73.4070, 620],
        [18.8120, 73.3980, 740],
        [18.8311, 73.3944, 826],
      ],
      waypoints: [
        TrailWaypoint(name: "Lonavala / Udhewadi Trail", type: "start", lat: 18.7550, lon: 73.4070),
        TrailWaypoint(name: "Udhewadi Village Camp", type: "campsite_water", lat: 18.8260, lon: 73.3960),
        TrailWaypoint(name: "Shrivardhan Fort Balekilla", type: "summit", lat: 18.8311, lon: 73.3944),
      ],
    ),
    TrailModel(
      id: "kalsubai",
      name: "Kalsubai Peak — Highest in Maharashtra",
      state: "Maharashtra",
      region: "Western Ghats",
      soiSheet: "47E/10",
      difficulty: "Moderate",
      distanceKm: 6.6,
      maxAltM: 1646,
      duration: "1 Day",
      description: "Ascent to the Everest of Maharashtra, featuring rocky volcanic staircases, iron ladders, and a summit temple overlooking Bhandardara Lake.",
      routeCoords: [
        [19.6225, 73.7190, 760],
        [19.6110, 73.7145, 1180],
        [19.6012, 73.7091, 1646],
      ],
      waypoints: [
        TrailWaypoint(name: "Bari Base Village", type: "start", lat: 19.6225, lon: 73.7190),
        TrailWaypoint(name: "Midway Well", type: "water", lat: 19.6110, lon: 73.7145),
        TrailWaypoint(name: "Kalsubai Summit", type: "summit", lat: 19.6012, lon: 73.7091),
      ],
    ),
    TrailModel(
      id: "kumara_parvatha",
      name: "Kumara Parvatha / Pushpagiri Trek",
      state: "Karnataka",
      region: "Western Ghats",
      soiSheet: "48P/11",
      difficulty: "Hard",
      distanceKm: 28.0,
      maxAltM: 1712,
      duration: "2 Days",
      description: "One of South India's toughest trails, ascending through dense Shola rainforests, Shesha Parvatha knife-edge ridge, and Pushpagiri cliffs.",
      routeCoords: [
        [12.6950, 75.6160, 180],
        [12.6765, 75.6575, 1080],
        [12.6690, 75.6760, 1520],
        [12.6639, 75.6853, 1712],
      ],
      waypoints: [
        TrailWaypoint(name: "Kukke Subramanya", type: "start", lat: 12.6950, lon: 75.6160),
        TrailWaypoint(name: "Bhattara Mane & Forest Checkpost", type: "campsite_water", lat: 12.6765, lon: 75.6575),
        TrailWaypoint(name: "Kallu Mantapa Stream", type: "water", lat: 12.6690, lon: 75.6760),
        TrailWaypoint(name: "Pushpagiri Peak", type: "summit", lat: 12.6639, lon: 75.6853),
      ],
    ),
    TrailModel(
      id: "david_scott",
      name: "David Scott Heritage Trail",
      state: "Meghalaya",
      region: "North-East",
      soiSheet: "78O/11",
      difficulty: "Easy-Moderate",
      distanceKm: 16.0,
      maxAltM: 1790,
      duration: "1 Day",
      description: "Historical British-era trade horse path through the Khasi Hills, Mawphlang sacred groves, crystal river canyons, and arched suspension bridges.",
      routeCoords: [
        [25.4420, 91.7510, 1790],
        [25.4180, 91.7450, 1480],
        [25.3980, 91.7620, 1540],
        [25.3880, 91.7890, 1650],
      ],
      waypoints: [
        TrailWaypoint(name: "Mawphlang Sacred Grove", type: "start", lat: 25.4420, lon: 91.7510),
        TrailWaypoint(name: "Umiam River Suspension Bridge", type: "water", lat: 25.4180, lon: 91.7450),
        TrailWaypoint(name: "Ladmawphlang Finish", type: "campsite", lat: 25.3880, lon: 91.7890),
      ],
    ),
  ];

  static TrailModel? findById(String id) {
    return trails.firstWhere((t) => t.id == id, orElse: () => trails.first);
  }
}
