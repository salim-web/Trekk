export interface TrailWaypoint {
  name: string;
  type: 'start' | 'campsite' | 'water' | 'campsite_water' | 'pass' | 'summit';
  lat: number;
  lon: number;
}

export interface TrailModel {
  id: string;
  name: string;
  state: string;
  region: 'Himalayas' | 'North-East' | 'Western Ghats' | 'Imported';
  soiSheet?: string;
  soiSheetNumber?: string;
  difficulty: 'Easy' | 'Moderate' | 'Moderate-Hard' | 'Hard' | 'Alpine Expedition' | 'Imported';
  distanceKm: number;
  maxAltM?: number;
  maxAltitudeM?: number;
  elevationGainM?: number;
  duration?: string;
  estimatedDurationHours?: number;
  description?: string;
  routeCoords: [number, number, number][]; // Strict [latitude, longitude, elevation]
  waypoints?: TrailWaypoint[];
  startCoord?: [number, number];
  endCoord?: [number, number];
  isImported?: boolean;
}

export const SeededTrails: TrailModel[] = [
  // 1. Kedarkantha Summit Trek
  {
    id: 'kedarkantha',
    name: 'Kedarkantha Summit Trek',
    state: 'Uttarakhand',
    region: 'Himalayas',
    soiSheet: '53J/1',
    soiSheetNumber: '53J/1',
    difficulty: 'Moderate',
    distanceKm: 20.0,
    maxAltM: 3810,
    maxAltitudeM: 3810,
    elevationGainM: 1860,
    duration: '4 Days',
    estimatedDurationHours: 16.0,
    description: 'Classic Garhwal snow trek through pine forests to a 360° summit panoramic view of Swargarohini and Bandarpoonch.',
    routeCoords: [
      [31.0772, 78.1831, 1950],
      [31.0735, 78.1895, 2240],
      [31.0698, 78.1942, 2510],
      [31.0665, 78.1982, 2770],
      [31.0590, 78.2020, 3050],
      [31.0520, 78.2055, 3260],
      [31.0460, 78.2045, 3430],
      [31.0385, 78.1950, 3590],
      [31.0310, 78.1840, 3710],
      [31.0238, 78.1722, 3810],
    ],
    waypoints: [
      { name: 'Sankri', type: 'start', lat: 31.0772, lon: 78.1831 },
      { name: 'Juda Ka Talab', type: 'campsite_water', lat: 31.0665, lon: 78.1982 },
      { name: 'Kedarkantha Base', type: 'campsite', lat: 31.0460, lon: 78.2045 },
      { name: 'Kedarkantha Summit', type: 'summit', lat: 31.0238, lon: 78.1722 },
    ],
  },

  // 2. Hampta Pass Crossover
  {
    id: 'hampta_pass',
    name: 'Hampta Pass Crossover',
    state: 'Himachal Pradesh',
    region: 'Himalayas',
    soiSheet: '52H/8',
    soiSheetNumber: '52H/8',
    difficulty: 'Moderate-Hard',
    distanceKm: 26.0,
    maxAltM: 4270,
    maxAltitudeM: 4270,
    elevationGainM: 1290,
    duration: '5 Days',
    estimatedDurationHours: 20.0,
    description: 'Dramatic crossover from lush green Kullu Valley into the stark alpine desert of Lahaul and Spiti.',
    routeCoords: [
      [32.2195, 77.2223, 2980],
      [32.2260, 77.2410, 3040],
      [32.2380, 77.2690, 3100],
      [32.2495, 77.2895, 3340],
      [32.2610, 77.3110, 3620],
      [32.2715, 77.3310, 3950],
      [32.2815, 77.3490, 4270],
      [32.2970, 77.3590, 4090],
      [32.3120, 77.3680, 3960],
      [32.3290, 77.3720, 3350],
    ],
    waypoints: [
      { name: 'Jobra', type: 'start', lat: 32.2195, lon: 77.2223 },
      { name: 'Jwara', type: 'water', lat: 32.2380, lon: 77.2690 },
      { name: 'Balu Ka Ghera', type: 'campsite', lat: 32.2610, lon: 77.3110 },
      { name: 'Hampta Pass', type: 'pass', lat: 32.2815, lon: 77.3490 },
      { name: 'Shea Goru', type: 'campsite_water', lat: 32.3120, lon: 77.3680 },
      { name: 'Chatru', type: 'summit', lat: 32.3290, lon: 77.3720 },
    ],
  },

  // 3. Dzukou Valley & Japfu Ridge
  {
    id: 'dzukou_valley',
    name: 'Dzukou Valley & Japfu Ridge',
    state: 'Nagaland / Manipur',
    region: 'North-East',
    soiSheet: '83K/2',
    soiSheetNumber: '83K/2',
    difficulty: 'Moderate',
    distanceKm: 17.5,
    maxAltM: 2610,
    maxAltitudeM: 2610,
    elevationGainM: 760,
    duration: '3 Days',
    estimatedDurationHours: 12.0,
    description: 'Emerald undulating dwarf-bamboo rolling meadows, rare endemic Dzukou lilies, and pristine river streams.',
    routeCoords: [
      [25.5680, 94.1160, 1850],
      [25.5620, 94.1045, 2210],
      [25.5540, 94.0920, 2610],
      [25.5565, 94.0825, 2520],
      [25.5582, 94.0736, 2452],
      [25.5505, 94.0690, 2440],
      [25.5410, 94.0650, 2430],
    ],
    waypoints: [
      { name: 'Viswema Trailhead', type: 'start', lat: 25.5680, lon: 94.1160 },
      { name: 'Rest House', type: 'campsite', lat: 25.5582, lon: 94.0736 },
      { name: 'Dzukou Valley Floor', type: 'summit', lat: 25.5410, lon: 94.0650 },
    ],
  },

  // 4. Sandakphu - Phalut Singalila Ridge
  {
    id: 'sandakphu',
    name: 'Sandakphu - Phalut Singalila Ridge',
    state: 'West Bengal / Sikkim',
    region: 'North-East',
    soiSheet: '78A/4',
    soiSheetNumber: '78A/4',
    difficulty: 'Moderate-Hard',
    distanceKm: 48.0,
    maxAltM: 3636,
    maxAltitudeM: 3636,
    elevationGainM: 1502,
    duration: '6 Days',
    estimatedDurationHours: 28.0,
    description: 'The Sleeping Buddha panorama: Kanchenjunga, Everest, Lhotse, and Makalu from the international Indo-Nepal border.',
    routeCoords: [
      [26.9890, 88.1200, 2134],
      [27.0080, 88.0950, 2650],
      [27.0310, 88.0680, 3070],
      [27.0540, 88.0310, 2621],
      [27.0780, 88.0150, 3108],
      [27.0920, 88.0080, 3400],
      [27.1059, 88.0016, 3636],
      [27.1580, 88.0090, 3550],
      [27.2111, 88.0190, 3600],
    ],
    waypoints: [
      { name: 'Manebhanjan', type: 'start', lat: 26.9890, lon: 88.1200 },
      { name: 'Tumling', type: 'campsite', lat: 27.0310, lon: 88.0680 },
      { name: 'Kalipokhri', type: 'water', lat: 27.0780, lon: 88.0150 },
      { name: 'Sandakphu Summit', type: 'summit', lat: 27.1059, lon: 88.0016 },
      { name: 'Phalut', type: 'pass', lat: 27.2111, lon: 88.0190 },
    ],
  },

  // 5. Valley of Flowers & Hemkund Sahib
  {
    id: 'valley_of_flowers',
    name: 'Valley of Flowers & Hemkund Sahib',
    state: 'Uttarakhand',
    region: 'Himalayas',
    soiSheet: '53N/10',
    soiSheetNumber: '53N/10',
    difficulty: 'Moderate',
    distanceKm: 38.0,
    maxAltM: 4329,
    maxAltitudeM: 4329,
    elevationGainM: 2501,
    duration: '4 Days',
    estimatedDurationHours: 22.0,
    description: 'UNESCO World Heritage Site with endemic alpine flowers, surrounded by glaciated peaks and the holy glacial lake of Hemkund.',
    routeCoords: [
      [30.6250, 79.5630, 1828],
      [30.6520, 79.5760, 2250],
      [30.6780, 79.5880, 2680],
      [30.7010, 79.5930, 3048],
      [30.7150, 79.5990, 3350],
      [30.7280, 79.6053, 3658],
      [30.7010, 79.5930, 3048],
      [30.7003, 79.6152, 4329],
    ],
    waypoints: [
      { name: 'Govindghat', type: 'start', lat: 30.6250, lon: 79.5630 },
      { name: 'Ghangaria', type: 'campsite', lat: 30.7010, lon: 79.5930 },
      { name: 'Valley of Flowers', type: 'pass', lat: 30.7280, lon: 79.6053 },
      { name: 'Hemkund Sahib', type: 'summit', lat: 30.7003, lon: 79.6152 },
    ],
  },

  // 6. Kashmir Great Lakes
  {
    id: 'kashmir_great_lakes',
    name: 'Kashmir Great Lakes',
    state: 'Jammu & Kashmir',
    region: 'Himalayas',
    soiSheet: '43N/3',
    soiSheetNumber: '43N/3',
    difficulty: 'Hard',
    distanceKm: 65.0,
    maxAltM: 4191,
    maxAltitudeM: 4191,
    elevationGainM: 2450,
    duration: '7 Days',
    estimatedDurationHours: 35.0,
    description: 'Traverse 7 high-altitude cobalt alpine lakes, pristine meadows, and cross Gadsar pass in the Kashmir Himalayas.',
    routeCoords: [
      [34.3030, 75.2670, 2740],
      [34.3350, 75.2390, 3380],
      [34.3650, 75.2110, 3570],
      [34.3950, 75.1950, 3710],
      [34.4020, 75.1740, 4080],
      [34.3980, 75.1520, 4191],
      [34.4150, 75.0890, 3650],
      [34.4260, 75.0120, 4100],
      [34.4320, 74.9450, 3575],
      [34.3520, 74.9820, 2280],
    ],
    waypoints: [
      { name: 'Sonamarg', type: 'start', lat: 34.3030, lon: 75.2670 },
      { name: 'Vishansar Lake', type: 'campsite_water', lat: 34.3950, lon: 75.1950 },
      { name: 'Gadsar Pass', type: 'pass', lat: 34.3980, lon: 75.1520 },
      { name: 'Gangabal Lake', type: 'water', lat: 34.4320, lon: 74.9450 },
      { name: 'Naranag', type: 'summit', lat: 34.3520, lon: 74.9820 },
    ],
  },

  // 7. Rajmachi & Shrivardhan Fort
  {
    id: 'rajmachi',
    name: 'Rajmachi & Shrivardhan Fort',
    state: 'Maharashtra',
    region: 'Western Ghats',
    soiSheet: '47F/5',
    soiSheetNumber: '47F/5',
    difficulty: 'Easy',
    distanceKm: 16.0,
    maxAltM: 826,
    maxAltitudeM: 826,
    elevationGainM: 206,
    duration: '1 Day',
    estimatedDurationHours: 6.0,
    description: 'Rugged Sahyadri escarpment hike past waterfalls and dense monsoon forests to twin Maratha hill forts.',
    routeCoords: [
      [18.7550, 73.4070, 620],
      [18.7740, 73.4040, 660],
      [18.7950, 73.4010, 710],
      [18.8120, 73.3980, 740],
      [18.8260, 73.3960, 770],
      [18.8311, 73.3944, 826],
    ],
    waypoints: [
      { name: 'Lonavala Trailhead', type: 'start', lat: 18.7550, lon: 73.4070 },
      { name: 'Udhewadi Base', type: 'campsite_water', lat: 18.8260, lon: 73.3960 },
      { name: 'Shrivardhan Fort', type: 'summit', lat: 18.8311, lon: 73.3944 },
    ],
  },

  // 8. Kalsubai Peak
  {
    id: 'kalsubai',
    name: 'Kalsubai Peak',
    state: 'Maharashtra',
    region: 'Western Ghats',
    soiSheet: '47E/10',
    soiSheetNumber: '47E/10',
    difficulty: 'Moderate',
    distanceKm: 6.6,
    maxAltM: 1646,
    maxAltitudeM: 1646,
    elevationGainM: 886,
    duration: '1 Day',
    estimatedDurationHours: 5.5,
    description: 'Climb the highest peak of Maharashtra via steel ladders along sheer basalt cliffs to panoramic Sahyadri views.',
    routeCoords: [
      [19.6225, 73.7190, 760],
      [19.6175, 73.7168, 980],
      [19.6110, 73.7145, 1180],
      [19.6060, 73.7118, 1420],
      [19.6012, 73.7091, 1646],
    ],
    waypoints: [
      { name: 'Bari Village', type: 'start', lat: 19.6225, lon: 73.7190 },
      { name: 'Midway Well', type: 'water', lat: 19.6110, lon: 73.7145 },
      { name: 'Kalsubai Summit', type: 'summit', lat: 19.6012, lon: 73.7091 },
    ],
  },

  // 9. Kumara Parvatha / Pushpagiri
  {
    id: 'kumara_parvatha',
    name: 'Kumara Parvatha / Pushpagiri',
    state: 'Karnataka',
    region: 'Western Ghats',
    soiSheet: '48P/11',
    soiSheetNumber: '48P/11',
    difficulty: 'Hard',
    distanceKm: 22.0,
    maxAltM: 1712,
    maxAltitudeM: 1712,
    elevationGainM: 1532,
    duration: '2 Days',
    estimatedDurationHours: 14.0,
    description: 'The toughest trek in the Western Ghats through dense Shola rain forests and windswept volcanic volcanic ridges.',
    routeCoords: [
      [12.6950, 75.6160, 180],
      [12.6860, 75.6380, 640],
      [12.6765, 75.6575, 1080],
      [12.6720, 75.6680, 1340],
      [12.6690, 75.6760, 1520],
      [12.6639, 75.6853, 1712],
    ],
    waypoints: [
      { name: 'Kukke Subramanya', type: 'start', lat: 12.6950, lon: 75.6160 },
      { name: 'Bhattara Mane', type: 'campsite_water', lat: 12.6765, lon: 75.6575 },
      { name: 'Kallu Mantapa', type: 'water', lat: 12.6690, lon: 75.6760 },
      { name: 'Pushpagiri Peak', type: 'summit', lat: 12.6639, lon: 75.6853 },
    ],
  },

  // 10. David Scott Heritage Trail
  {
    id: 'david_scott',
    name: 'David Scott Heritage Trail',
    state: 'Meghalaya',
    region: 'North-East',
    soiSheet: '78O/11',
    soiSheetNumber: '78O/11',
    difficulty: 'Moderate',
    distanceKm: 16.0,
    maxAltM: 1790,
    maxAltitudeM: 1790,
    elevationGainM: 200,
    duration: '1 Day',
    estimatedDurationHours: 6.0,
    description: 'Historic British-Khasi war horse cart trail winding through canyon gorges, crystal clear Umiam river pools, and living root bridges.',
    routeCoords: [
      [25.4420, 91.7510, 1790],
      [25.4310, 91.7475, 1610],
      [25.4180, 91.7450, 1480],
      [25.4080, 91.7540, 1510],
      [25.3980, 91.7620, 1540],
      [25.3920, 91.7760, 1595],
      [25.3880, 91.7890, 1650],
    ],
    waypoints: [
      { name: 'Mawphlang Sacred Grove', type: 'start', lat: 25.4420, lon: 91.7510 },
      { name: 'Umiam Suspension Bridge', type: 'water', lat: 25.4180, lon: 91.7450 },
      { name: 'Ka Kor Ksiar', type: 'campsite', lat: 25.3980, lon: 91.7620 },
      { name: 'Ladmawphlang', type: 'summit', lat: 25.3880, lon: 91.7890 },
    ],
  },
];

export const SEEDED_TRAILS: TrailModel[] = SeededTrails;
export default SeededTrails;
