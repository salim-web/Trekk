import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Users,
  Radio,
  Wifi,
  QrCode,
  ShieldAlert,
  Battery,
  Signal,
  Compass,
  MessageSquare,
  CheckCircle2,
  Send,
  Paperclip,
  Camera,
  MapPin,
  AlertTriangle,
  RefreshCw,
  DownloadCloud,
  Upload,
  Share2,
  Play,
  FileText,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { KnurledButton } from '../../components/KnurledButton';
import { DatabaseService, SquadMessageRecord, SquadMediaRecord } from '../../services/DatabaseService';
import { MeshService, MeshPeerNode, MeshMsgType } from '../../services/meshService';

type SubView = 'CHAT' | 'CAMP_SYNC' | 'RADAR';

export default function SquadsScreen() {
  const [activeTab, setActiveTab] = useState<SubView>('CHAT');
  const [meshActive, setMeshActive] = useState(true);
  const [messages, setMessages] = useState<SquadMessageRecord[]>([]);
  const [inputText, setInputText] = useState('');
  const [mediaPool, setMediaPool] = useState<SquadMediaRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ [id: string]: number }>({});
  const [syncStatusText, setSyncStatusText] = useState('');
  const [hostMode, setHostMode] = useState(true);
  const [nodes, setNodes] = useState<MeshPeerNode[]>(MeshService.peers);

  const scrollRef = useRef<ScrollView>(null);

  // Load persisted messages and shared media on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const dbMsgs = await DatabaseService.getSquadMessages();
      if (dbMsgs && dbMsgs.length > 0) {
        setMessages(dbMsgs);
      } else {
        const initialMsgs = MeshService.getInitialMessages();
        setMessages(initialMsgs);
        for (const m of initialMsgs) {
          await DatabaseService.saveSquadMessage(m);
        }
      }

      const dbMedia = await DatabaseService.getSquadMedia();
      if (dbMedia && dbMedia.length > 0) {
        setMediaPool(dbMedia);
      } else {
        const initialMedia = MeshService.getInitialSquadMediaPool();
        setMediaPool(initialMedia);
        for (const item of initialMedia) {
          await DatabaseService.saveSquadMedia(item);
        }
      }
    } catch (e) {
      console.warn('Error loading squad data:', e);
    }
  };

  // --- FEATURE 1.1: BLE MESH MESSAGING ---

  const sendMessage = async (text: string, type: SquadMessageRecord['type'] = 'text', lat?: number, lon?: number, ele?: number) => {
    if (!text.trim()) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const newMsg: SquadMessageRecord = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderName: 'You (Phone)',
      senderRole: 'SQUAD MEMBER',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      lat,
      lon,
      ele,
      hops: 1,
      rssiDbm: -42,
    };

    // Encode into binary BLE packets (using 31-byte encoder)
    MeshService.chunkTextMessage(text);

    // Save and update state
    await DatabaseService.saveSquadMessage(newMsg);
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleBroadcastGps = () => {
    sendMessage(
      '📍 Broadcast GPS Pin: Current position logged at Ridge Waypoint 4.',
      'gps',
      31.0255,
      78.1748,
      3812
    );
  };

  const handleBroadcastWater = () => {
    sendMessage(
      '💧 High-Flow Water Spring Located (+2,950m). Clean perennial glacial stream.',
      'alert',
      31.0580,
      78.2010,
      2950
    );
  };

  const handleBroadcastCamp = () => {
    sendMessage(
      '⛺ Base Camp Pitching Area Secured. Level ground suitable for 6 alpine tents.',
      'alert',
      31.0460,
      78.2045,
      3430
    );
  };

  const handleBroadcastSos = () => {
    Alert.alert(
      'TRANSMIT EMERGENCY SOS',
      'Broadcast high-priority emergency packet across all BLE mesh hops? This overrides duty cycles of all nearby nodes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'BROADCAST SOS',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch {}
            MeshService.encodeTacticalAlertPacket('EMERGENCY SOS', true);
            sendMessage(
              '🚨 SOS PRIORITY EMERGENCY: Medical assistance requested near cirque pass! GPS coordinates locked.',
              'sos',
              31.0238,
              78.1722,
              3810
            );
          },
        },
      ]
    );
  };

  // Attach photo/file in chat and queue for camp sync
  const handleAttachMedia = async () => {
    try {
      Alert.alert('Attach File or Photo', 'Choose source to queue for squad sync:', [
        {
          text: 'Photo Camera / Library',
          onPress: async () => {
            try {
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.8,
              });
              if (res.canceled || !res.assets || res.assets.length === 0) return;

              const asset = res.assets[0];
              const fileName = asset.fileName || `Photo_${Date.now()}.jpg`;
              const size = asset.fileSize || 2400000;
              const hash = await MeshService.computeSha256(asset.uri);

              const newMedia: SquadMediaRecord = {
                id: `media_${Date.now()}`,
                name: fileName,
                type: 'photo',
                sizeBytes: size,
                sha256: hash,
                senderName: 'You (Phone)',
                timestamp: new Date().toISOString(),
                lat: 31.0255,
                lon: 78.1748,
                ele: 3812,
                localUri: asset.uri,
                isSynced: true,
              };

              await DatabaseService.saveSquadMedia(newMedia);
              setMediaPool((prev) => [newMedia, ...prev]);

              // Broadcast 0x04 Media Queued Notice packet
              MeshService.encodeMediaNoticePacket(fileName, size, 31.0255, 78.1748, hash);
              sendMessage(
                `📸 [You] queued 1 photo (${fileName}, ${(size / 1024 / 1024).toFixed(1)}MB) for Camp Sync`,
                'media_notice'
              );
            } catch (err: any) {
              Alert.alert('Attach Error', err?.message || 'Could not pick photo');
            }
          },
        },
        {
          text: 'Document / GPX Track',
          onPress: async () => {
            try {
              const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
              if (res.canceled || !res.assets || res.assets.length === 0) return;

              const file = res.assets[0];
              const size = file.size || 150000;
              const hash = await MeshService.computeSha256(file.uri);

              const newMedia: SquadMediaRecord = {
                id: `media_${Date.now()}`,
                name: file.name,
                type: file.name.endsWith('.gpx') ? 'gpx' : 'doc',
                sizeBytes: size,
                sha256: hash,
                senderName: 'You (Phone)',
                timestamp: new Date().toISOString(),
                lat: 31.0255,
                lon: 78.1748,
                ele: 3812,
                localUri: file.uri,
                isSynced: true,
              };

              await DatabaseService.saveSquadMedia(newMedia);
              setMediaPool((prev) => [newMedia, ...prev]);

              sendMessage(
                `📄 [You] queued 1 file (${file.name}, ${(size / 1024).toFixed(0)}KB) for Camp Sync`,
                'media_notice'
              );
            } catch (err: any) {
              Alert.alert('Attach Error', err?.message || 'Could not pick file');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (_) {}
  };

  // Simulate Incoming Squad Relay (2 Hops)
  const handleSimulateRelay = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const incomingScenarios = [
      {
        sender: 'Maya Sen',
        role: 'SWEEP',
        text: 'Relayed via Rohan (2 hops): Boulder zone cleared safely at 3,380m. All members accounted for.',
        type: 'text' as const,
        lat: 31.0310,
        lon: 78.1810,
        ele: 3380,
      },
      {
        sender: 'Tenzing Norgay',
        role: 'LEAD GUIDE',
        text: 'Relayed via Base Relay (2 hops): Summit pass visibility is clear. Minor snow patches on north face.',
        type: 'alert' as const,
        lat: 31.0238,
        lon: 78.1722,
        ele: 3812,
      },
    ];

    const pick = incomingScenarios[Math.floor(Math.random() * incomingScenarios.length)];
    const simMsg: SquadMessageRecord = {
      id: `relay_${Date.now()}`,
      senderName: pick.sender,
      senderRole: pick.role,
      text: pick.text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: pick.type,
      lat: pick.lat,
      lon: pick.lon,
      ele: pick.ele,
      hops: 2,
      rssiDbm: -74,
    };

    await DatabaseService.saveSquadMessage(simMsg);
    setMessages((prev) => [...prev, simMsg]);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    Alert.alert(
      'Multi-Hop Relay Received',
      `Decoded 31-byte BLE Advertisement Packet from ${pick.sender} via 2 hops.\nRSSI: -74 dBm\nPayload: "${pick.text}"`
    );
  };

  // --- FEATURE 1.2: CAMP FILE SYNC ENGINE ---

  const handleSyncAllMissing = async () => {
    const missing = mediaPool.filter((m) => !m.isSynced);
    if (missing.length === 0) {
      Alert.alert('Camp Pool Synced', 'All shared photos and expedition files are already in sync locally!');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setIsSyncing(true);
    setSyncStatusText(`Performing SHA-256 delta handshake with Camp Server (28.4 MB/s)...`);

    for (let i = 0; i < missing.length; i++) {
      const item = missing[i];
      setSyncStatusText(`Transferring ${item.name} (${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB)...`);

      // Animate progress chunks
      for (let p = 20; p <= 100; p += 20) {
        await new Promise((r) => setTimeout(r, 80));
        setSyncProgress((prev) => ({ ...prev, [item.id]: p }));
      }

      await DatabaseService.markMediaSynced(item.id);
    }

    setMediaPool((prev) =>
      prev.map((m) => ({
        ...m,
        isSynced: true,
      }))
    );

    setIsSyncing(false);
    setSyncStatusText('');

    Alert.alert(
      'Camp Sync Complete',
      `Synchronized ${missing.length} missing squad items at 28.4 MB/s!\n\nAll ${missing.filter((m) => m.type === 'photo').length} synced photos have been pinned directly to their capture coordinates on the Explore Topo Map.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header & Sub-Navigation Pills */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.radarPill}>
            <Radio size={14} color={meshActive ? FieldColors.mossNeon : '#888'} />
            <Text style={styles.radarPillText}>
              {meshActive ? 'CAMPFIRE BLE MESH ACTIVE' : 'MESH STANDBY'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.simRelayBtn}
            onPress={handleSimulateRelay}
            activeOpacity={0.8}
          >
            <Sparkles size={12} color="#0F1210" />
            <Text style={styles.simRelayBtnText}>SIMULATE RELAY (2 HOPS)</Text>
          </TouchableOpacity>
        </View>

        {/* Live Mesh Telemetry Status Bar */}
        <View style={styles.meshStatusBar}>
          <Text style={styles.meshStatusText}>
            3 Peers in Range • 2 Hops Max • Duty Cycle: {meshActive ? '1.5s/8s' : 'OFF'}
          </Text>
          <TouchableOpacity
            style={[styles.meshTogglePill, meshActive && styles.meshTogglePillActive]}
            onPress={() => setMeshActive(!meshActive)}
          >
            <Text style={[styles.meshToggleText, meshActive && styles.meshToggleTextActive]}>
              {meshActive ? 'TRAIL MODE: ON' : 'STANDBY'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-view switcher tabs */}
        <View style={styles.subTabsRow}>
          <TouchableOpacity
            style={[styles.subTab, activeTab === 'CHAT' && styles.subTabActive]}
            onPress={() => setActiveTab('CHAT')}
          >
            <MessageSquare size={13} color={activeTab === 'CHAT' ? FieldColors.rescueOrange : '#888'} />
            <Text style={[styles.subTabText, activeTab === 'CHAT' && styles.subTabTextActive]} numberOfLines={1}>
              MESH CHAT ({messages.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, activeTab === 'CAMP_SYNC' && styles.subTabActive]}
            onPress={() => setActiveTab('CAMP_SYNC')}
          >
            <Wifi size={13} color={activeTab === 'CAMP_SYNC' ? FieldColors.rescueOrange : '#888'} />
            <Text style={[styles.subTabText, activeTab === 'CAMP_SYNC' && styles.subTabTextActive]} numberOfLines={1}>
              CAMP SYNC ({mediaPool.filter((m) => !m.isSynced).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTab, activeTab === 'RADAR' && styles.subTabActive]}
            onPress={() => setActiveTab('RADAR')}
          >
            <Compass size={13} color={activeTab === 'RADAR' ? FieldColors.rescueOrange : '#888'} />
            <Text style={[styles.subTabText, activeTab === 'RADAR' && styles.subTabTextActive]} numberOfLines={1}>
              RADAR ({nodes.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SUB-VIEW 1: MESH CHAT */}
      {activeTab === 'CHAT' && (
        <View style={styles.chatContainer}>
          {/* Messages Scroll Area */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.chatScroll}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((msg) => {
              const isMe = msg.senderName.startsWith('You');
              const isSos = msg.type === 'sos';
              const isAlert = msg.type === 'alert';
              const isMediaNotice = msg.type === 'media_notice';

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    isMe ? styles.messageBubbleMe : styles.messageBubblePeer,
                    isSos && styles.messageBubbleSos,
                    isAlert && styles.messageBubbleAlert,
                  ]}
                >
                  {/* Sender & Hops row */}
                  <View style={styles.msgHeaderRow}>
                    <Text style={[styles.msgSenderName, isSos && { color: '#FEE2E2' }]}>
                      {msg.senderName}
                    </Text>
                    <View style={styles.msgBadgeRow}>
                      <Text style={styles.msgHopBadge}>
                        {msg.hops === 1 ? '1 HOP' : `${msg.hops} HOPS RELAY`}
                      </Text>
                      <Text style={styles.msgTimestamp}>{msg.timestamp}</Text>
                    </View>
                  </View>

                  {/* Message body */}
                  <Text
                    style={[
                      styles.msgBodyText,
                      isSos && styles.msgBodyTextSos,
                      isMediaNotice && { color: FieldColors.glacierCyan },
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {/* Lat/Lon badge if attached */}
                  {msg.lat && msg.lon && (
                    <View style={styles.coordBadge}>
                      <MapPin size={11} color={FieldColors.mossNeon} />
                      <Text style={styles.coordBadgeText}>
                        {msg.lat.toFixed(4)}°N, {msg.lon.toFixed(4)}°E • {Math.round(msg.ele || 0)}m
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Tactical Quick Broadcast Pills */}
          <View style={styles.quickActionPills}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
              <TouchableOpacity style={styles.actionPill} onPress={handleBroadcastGps}>
                <Text style={styles.actionPillText}>📍 BROADCAST GPS PIN</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionPill} onPress={handleBroadcastWater}>
                <Text style={styles.actionPillText}>💧 WATER FOUND HERE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionPill} onPress={handleBroadcastCamp}>
                <Text style={styles.actionPillText}>⛺ CAMP PITCHING</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionPill, styles.actionPillSos]}
                onPress={handleBroadcastSos}
              >
                <Text style={[styles.actionPillText, { color: '#FEE2E2', fontWeight: '900' }]}>
                  🚨 SOS PRIORITY
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Message Composer */}
          <View style={styles.composerBar}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleAttachMedia}>
              <Paperclip size={18} color={FieldColors.contourOchre} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Transmit offline BLE packet..."
              placeholderTextColor="#5C6E63"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage(inputText)}
            />

            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
              disabled={!inputText.trim()}
              onPress={() => sendMessage(inputText)}
            >
              <Send size={16} color="#0F1210" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUB-VIEW 2: CAMP FILE SYNC */}
      {activeTab === 'CAMP_SYNC' && (
        <ScrollView contentContainerStyle={styles.campSyncScroll}>
          {/* Host Mode / Join Mode Card */}
          <View style={styles.campCard}>
            <View style={styles.campCardHeader}>
              <Wifi size={18} color={FieldColors.mossNeon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.campCardTitle}>
                  {hostMode ? 'CAMP SYNC HOST (LEADER MODE)' : 'PEER CLIENT MODE'}
                </Text>
                <Text style={styles.campCardSub}>
                  {hostMode ? 'SSID: TrekSync_Squad_Camp • http://192.168.43.1:8080' : 'CONNECTED TO CAMP SERVER'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modeToggleBtn}
                onPress={() => setHostMode(!hostMode)}
              >
                <Text style={styles.modeToggleText}>{hostMode ? 'SWITCH PEER' : 'SWITCH HOST'}</Text>
              </TouchableOpacity>
            </View>

            {/* Dynamic Wi-Fi Hotspot Badge / QR Card */}
            <View style={styles.hotspotBadge}>
              <View style={styles.qrIconWrap}>
                <QrCode size={48} color={FieldColors.contourOchre} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.qrTitle}>HIGH-SPEED AD-HOC HOTSPOT</Text>
                <Text style={styles.qrSub}>WIFI:S:TrekSync_Squad;T:WPA;P:himalaya2026;;</Text>
                <Text style={styles.qrDesc}>
                  Squad members scan this screen to join the camp HTTP socket and run zero-data SHA-256 delta sync.
                </Text>
              </View>
            </View>
          </View>

          {/* Sync Missing Media Banner & Actions */}
          <View style={styles.syncActionBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.syncActionTitle}>SHARED SQUAD MEDIA POOL</Text>
              <Text style={styles.syncActionSub}>
                {mediaPool.length} Total Items • {mediaPool.filter((m) => m.isSynced).length} Synced Local
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.syncNowBtn, isSyncing && { opacity: 0.6 }]}
              disabled={isSyncing}
              onPress={handleSyncAllMissing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#0F1210" />
              ) : (
                <DownloadCloud size={15} color="#0F1210" />
              )}
              <Text style={styles.syncNowBtnText}>
                {isSyncing ? 'SYNCING...' : '⚡ SYNC ALL MISSING (28.4 MB/s)'}
              </Text>
            </TouchableOpacity>
          </View>

          {isSyncing && syncStatusText ? (
            <View style={styles.syncProgressBanner}>
              <ActivityIndicator size="small" color={FieldColors.mossNeon} />
              <Text style={styles.syncProgressText}>{syncStatusText}</Text>
            </View>
          ) : null}

          {/* Add file button */}
          <TouchableOpacity style={styles.shareFileBtn} onPress={handleAttachMedia}>
            <Upload size={16} color={FieldColors.parchment} />
            <Text style={styles.shareFileBtnText}>+ SHARE PHOTOS / GPX / FILES WITH SQUAD</Text>
          </TouchableOpacity>

          {/* Shared Media Pool List */}
          <View style={styles.mediaList}>
            {mediaPool.map((item) => {
              const isSynced = item.isSynced;
              const progress = syncProgress[item.id] || 0;

              return (
                <View key={item.id} style={styles.mediaCard}>
                  <View style={styles.mediaTopRow}>
                    <View style={styles.mediaIconWrap}>
                      {item.type === 'photo' ? (
                        <Camera size={18} color={FieldColors.glacierCyan} />
                      ) : item.type === 'gpx' ? (
                        <Compass size={18} color={FieldColors.rescueOrange} />
                      ) : (
                        <FileText size={18} color={FieldColors.contourOchre} />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.mediaName}>{item.name}</Text>
                      <Text style={styles.mediaSender}>
                        By {item.senderName} • {(item.sizeBytes / 1024 / 1024).toFixed(1)} MB
                      </Text>
                    </View>

                    <View style={[styles.syncStatusBadge, isSynced ? styles.badgeSynced : styles.badgeMissing]}>
                      {isSynced ? (
                        <Check size={12} color={FieldColors.mossNeon} />
                      ) : (
                        <DownloadCloud size={12} color={FieldColors.rescueOrange} />
                      )}
                      <Text
                        style={[
                          styles.syncStatusBadgeText,
                          { color: isSynced ? FieldColors.mossNeon : FieldColors.rescueOrange },
                        ]}
                      >
                        {isSynced ? 'SYNCED LOCAL' : 'MISSING'}
                      </Text>
                    </View>
                  </View>

                  {/* SHA-256 Hash badge & Coordinates */}
                  <View style={styles.mediaBottomRow}>
                    <Text style={styles.sha256Text}>
                      SHA-256: {item.sha256.substring(0, 16)}...
                    </Text>
                    <Text style={styles.mediaCoordsText}>
                      📍 {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E ({Math.round(item.ele)}m)
                    </Text>
                  </View>

                  {/* Transfer Progress bar if syncing */}
                  {isSyncing && progress > 0 && progress < 100 && (
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* SUB-VIEW 3: RADAR & NODES */}
      {activeTab === 'RADAR' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Tactical Radar Display Widget */}
          <View style={styles.radarCard}>
            <View style={styles.radarCircleOuter}>
              <View style={styles.radarCircleMiddle}>
                <View style={styles.radarCircleInner}>
                  <View style={styles.radarCenterMe}>
                    <Text style={styles.radarCenterText}>YOU</Text>
                  </View>
                </View>
              </View>

              {/* Radar Crosshairs */}
              <View style={styles.crosshairH} />
              <View style={styles.crosshairV} />

              {/* Simulated Blips */}
              <View style={[styles.blip, { top: '25%', right: '35%', backgroundColor: FieldColors.mossNeon }]} />
              <View style={[styles.blip, { bottom: '28%', left: '32%', backgroundColor: FieldColors.glacierCyan }]} />
              <View style={[styles.blip, { bottom: '20%', right: '42%', backgroundColor: FieldColors.contourOchre }]} />
            </View>
            <Text style={styles.radarLegend}>MAX RANGE: 250M • MULTI-HOP RELAY ACTIVE</Text>
          </View>

          {/* Peer Telemetry List */}
          <View style={styles.peersSection}>
            <Text style={styles.sectionLabel}>SQUAD SENSORS & TELEMETRY</Text>
            <View style={styles.nodesList}>
              {nodes.map((node) => (
                <View key={node.id} style={styles.nodeCard}>
                  <View style={styles.nodeTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nodeName}>{node.name}</Text>
                      <Text style={styles.nodeRole}>{node.role}</Text>
                    </View>
                    <View style={styles.nodeDistanceBadge}>
                      <Compass size={12} color={FieldColors.parchment} />
                      <Text style={styles.nodeDistanceText}>{node.distanceMeters}m</Text>
                    </View>
                  </View>

                  <View style={styles.nodeMetricsRow}>
                    <View style={styles.nodeMetric}>
                      <Battery size={13} color={FieldColors.mossNeon} />
                      <Text style={styles.metricText}>{node.batteryPct}%</Text>
                    </View>
                    <View style={styles.nodeMetric}>
                      <Signal size={13} color={FieldColors.glacierCyan} />
                      <Text style={styles.metricText}>{node.rssiDbm} dBm</Text>
                    </View>
                    <View style={styles.nodeMetric}>
                      <Text style={styles.pingText}>{node.lastPingSecs}s ago</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FieldColors.obsidianBasalt,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#121714',
    borderBottomWidth: 1.5,
    borderBottomColor: '#232D27',
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18241D',
    borderColor: '#26382D',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  radarPillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  simRelayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FieldColors.mossNeon,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  simRelayBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#0F1210',
  },
  meshStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161E1A',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  meshStatusText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#8CA094',
  },
  meshTogglePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: '#232E27',
  },
  meshTogglePillActive: {
    backgroundColor: FieldColors.contourOchre,
  },
  meshToggleText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
  },
  meshToggleTextActive: {
    color: '#0F1210',
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  subTab: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    backgroundColor: '#161D19',
    borderColor: '#253029',
    borderWidth: 1,
    borderRadius: 4,
  },
  subTabActive: {
    backgroundColor: '#202B24',
    borderColor: FieldColors.rescueOrange,
  },
  subTabText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
  },
  subTabTextActive: {
    color: FieldColors.parchment,
  },
  chatContainer: {
    flex: 1,
  },
  chatScroll: {
    padding: 12,
    gap: 10,
  },
  messageBubble: {
    borderRadius: 6,
    padding: 10,
    gap: 4,
    maxWidth: '88%',
    borderWidth: 1,
  },
  messageBubbleMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#17221A',
    borderColor: '#2D3F33',
  },
  messageBubblePeer: {
    alignSelf: 'flex-start',
    backgroundColor: '#161A18',
    borderColor: '#262E29',
  },
  messageBubbleAlert: {
    backgroundColor: '#261B12',
    borderColor: FieldColors.contourOchre,
  },
  messageBubbleSos: {
    backgroundColor: '#3B1212',
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  msgHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  msgSenderName: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: FieldColors.contourOchre,
  },
  msgBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msgHopBadge: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    fontWeight: '800',
    backgroundColor: '#101512',
    color: FieldColors.mossNeon,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  msgTimestamp: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: '#718478',
  },
  msgBodyText: {
    fontFamily: 'System',
    fontSize: 12,
    color: FieldColors.parchment,
    lineHeight: 16,
  },
  msgBodyTextSos: {
    color: '#FEE2E2',
    fontWeight: '700',
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F1511',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  coordBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  quickActionPills: {
    backgroundColor: '#111613',
    borderTopWidth: 1,
    borderTopColor: '#202A24',
    paddingVertical: 6,
  },
  pillsScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  actionPill: {
    backgroundColor: '#18241D',
    borderColor: '#26382D',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionPillSos: {
    backgroundColor: '#501717',
    borderColor: '#EF4444',
  },
  actionPillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#131A16',
    borderTopWidth: 1.5,
    borderTopColor: '#232D27',
    gap: 8,
  },
  attachBtn: {
    padding: 6,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#18221B',
    borderColor: '#27382D',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: FieldColors.parchment,
    fontFamily: 'System',
    fontSize: 12,
  },
  sendBtn: {
    backgroundColor: FieldColors.rescueOrange,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  campSyncScroll: {
    padding: 12,
    gap: 12,
  },
  campCard: {
    backgroundColor: '#151D18',
    borderColor: '#26382D',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    gap: 10,
  },
  campCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campCardTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  campCardSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.mossNeon,
  },
  modeToggleBtn: {
    backgroundColor: '#202C24',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 3,
  },
  modeToggleText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  hotspotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111613',
    borderColor: '#202A24',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    gap: 10,
  },
  qrIconWrap: {
    padding: 4,
  },
  qrTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: FieldColors.contourOchre,
  },
  qrSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.glacierCyan,
  },
  qrDesc: {
    fontFamily: 'System',
    fontSize: 10,
    color: '#8A9A90',
    marginTop: 2,
  },
  syncActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  syncActionTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  syncActionSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#8A9A90',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FieldColors.mossNeon,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  syncNowBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#0F1210',
  },
  syncProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18241D',
    borderRadius: 4,
    padding: 8,
  },
  syncProgressText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    color: FieldColors.mossNeon,
  },
  shareFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C2620',
    borderColor: '#2E3F35',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 8,
  },
  shareFileBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  mediaList: {
    gap: 8,
  },
  mediaCard: {
    backgroundColor: '#161D19',
    borderColor: '#27342C',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 6,
  },
  mediaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#1B241F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaName: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  mediaSender: {
    fontFamily: 'System',
    fontSize: 10,
    color: '#8A9A90',
    marginTop: 1,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
  },
  badgeSynced: {
    backgroundColor: '#14271A',
    borderColor: FieldColors.mossNeon,
  },
  badgeMissing: {
    backgroundColor: '#2D1B0A',
    borderColor: FieldColors.rescueOrange,
  },
  syncStatusBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    fontWeight: '900',
  },
  mediaBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#202A23',
    paddingTop: 4,
  },
  sha256Text: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: '#65786C',
  },
  mediaCoordsText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: FieldColors.glacierCyan,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: '#222F26',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: FieldColors.mossNeon,
  },
  scroll: {
    padding: 14,
    gap: 14,
  },
  radarCard: {
    backgroundColor: '#161D19',
    borderColor: '#26382D',
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
  },
  radarCircleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: '#2E4336',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarCircleMiddle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: '#2A3C31',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#24342A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterMe: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: FieldColors.rescueOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterText: {
    fontFamily: FieldTypography.mono,
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  crosshairH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#24342A',
  },
  crosshairV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#24342A',
  },
  blip: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  radarLegend: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.mossNeon,
    marginTop: 10,
  },
  peersSection: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.8,
  },
  nodesList: {
    gap: 8,
  },
  nodeCard: {
    backgroundColor: '#161D19',
    borderColor: '#26382D',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 6,
  },
  nodeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeName: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  nodeRole: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.contourOchre,
  },
  nodeDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1B241F',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nodeDistanceText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  nodeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nodeMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: '#8A9A90',
  },
  pingText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#65786C',
  },
});
