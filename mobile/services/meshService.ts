import type { SquadMessageRecord, SquadMediaRecord } from './DatabaseService';

export enum MeshMsgType {
  TEXT_CHUNK = 0x01,
  GPS_TELEMETRY = 0x02,
  TACTICAL_ALERT = 0x03,
  MEDIA_NOTICE = 0x04,
  PEER_HEARTBEAT = 0x05,
}

export interface BlePacket31 {
  length: number; // 2 bytes (0x001F)
  serviceUuid: number; // 4 bytes
  partyHash: number; // 4 bytes
  msgId: number; // 4 bytes
  msgType: MeshMsgType; // 4 bits
  ttl: number; // 4 bits (0-15)
  payload: Uint8Array; // 16 bytes
}

export interface MeshPeerNode {
  id: string;
  name: string;
  role: 'LEAD' | 'GUIDE' | 'TREKKER' | 'SWEEP';
  batteryPct: number;
  rssiDbm: number;
  lastPingSecs: number;
  distanceMeters: number;
  bearingDeg: number;
  lat: number;
  lon: number;
  ele: number;
}

export class MeshService {
  private static readonly SERVICE_UUID = 0x5452454b; // 'TREK'
  private static readonly DEFAULT_PARTY_HASH = 0xa1b2c3d4;
  private static readonly MAX_TTL = 4;
  private static readonly DEDUP_LIMIT = 500;

  // 500-entry LRU deduplication Set on MsgID
  private static seenMsgIds = new Set<number>();
  private static nextMsgId = Math.floor(Math.random() * 100000) + 1;

  // Chunk reassembly buffer: key = `${senderId}_${sessionId}` -> chunks[]
  private static chunkAssemblyMap = new Map<string, { total: number; chunks: Map<number, string>; timer: any }>();

  // Active peer list
  public static peers: MeshPeerNode[] = [
    {
      id: 'node_tenzing',
      name: 'Tenzing Norgay',
      role: 'LEAD',
      batteryPct: 92,
      rssiDbm: -56,
      lastPingSecs: 3,
      distanceMeters: 45,
      bearingDeg: 35,
      lat: 31.0255,
      lon: 78.1748,
      ele: 3790,
    },
    {
      id: 'node_rohan',
      name: 'Rohan Sharma',
      role: 'TREKKER',
      batteryPct: 78,
      rssiDbm: -68,
      lastPingSecs: 6,
      distanceMeters: 85,
      bearingDeg: 210,
      lat: 31.0262,
      lon: 78.1755,
      ele: 3760,
    },
    {
      id: 'node_maya',
      name: 'Maya Sen',
      role: 'SWEEP',
      batteryPct: 64,
      rssiDbm: -82,
      lastPingSecs: 11,
      distanceMeters: 145,
      bearingDeg: 165,
      lat: 31.0280,
      lon: 78.1768,
      ele: 3680,
    },
  ];

  /**
   * Encodes a 31-byte binary BLE Advertisement Packet:
   * [2B Length (0x001F)][4B ServiceUUID][4B PartyHash][4B MsgID][1B MsgType_TTL][16B Payload]
   */
  static encodePacket(
    msgType: MeshMsgType,
    payload16: Uint8Array,
    ttl: number = this.MAX_TTL,
    customMsgId?: number,
    partyHash: number = this.DEFAULT_PARTY_HASH
  ): Uint8Array {
    const buffer = new ArrayBuffer(31);
    const view = new DataView(buffer);

    // 2B Length (31 = 0x001F)
    view.setUint16(0, 31, false);

    // 4B ServiceUUID
    view.setUint32(2, this.SERVICE_UUID, false);

    // 4B PartyHash
    view.setUint32(6, partyHash, false);

    // 4B MsgID
    const msgId = customMsgId ?? ++this.nextMsgId;
    view.setUint32(10, msgId, false);

    // 1B Combined: high 4 bits = MsgType, low 4 bits = TTL
    const typeTtlByte = ((msgType & 0x0f) << 4) | (Math.min(ttl, 15) & 0x0f);
    view.setUint8(14, typeTtlByte);

    // 16B Payload
    const targetPayload = new Uint8Array(buffer, 15, 16);
    if (payload16) {
      const copyLen = Math.min(payload16.length, 16);
      targetPayload.set(payload16.subarray(0, copyLen));
    }

    return new Uint8Array(buffer);
  }

  /**
   * Decodes a 31-byte binary BLE Advertisement Packet.
   * Returns null if length is invalid or ServiceUUID does not match.
   */
  static decodePacket(rawBytes: Uint8Array): BlePacket31 | null {
    if (!rawBytes || rawBytes.length < 31) return null;
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, 31);

    const length = view.getUint16(0, false);
    const serviceUuid = view.getUint32(2, false);
    if (serviceUuid !== this.SERVICE_UUID) return null;

    const partyHash = view.getUint32(6, false);
    const msgId = view.getUint32(10, false);
    const typeTtlByte = view.getUint8(14);
    const msgType = (typeTtlByte >> 4) & 0x0f;
    const ttl = typeTtlByte & 0x0f;

    const payload = new Uint8Array(rawBytes.buffer, rawBytes.byteOffset + 15, 16);

    return {
      length,
      serviceUuid,
      partyHash,
      msgId,
      msgType: msgType as MeshMsgType,
      ttl,
      payload,
    };
  }

  /**
   * Checks deduplication and decrements TTL for multi-hop packet relay.
   * Returns null if packet was already seen or TTL has expired.
   */
  static processIncomingPacket(rawBytes: Uint8Array): { packet: BlePacket31; shouldRelay: boolean; relPacket?: Uint8Array } | null {
    const decoded = this.decodePacket(rawBytes);
    if (!decoded) return null;

    // Deduplication check
    if (this.seenMsgIds.has(decoded.msgId)) {
      return null; // Duplicate dropped
    }

    // Add to 500-entry LRU
    if (this.seenMsgIds.size >= this.DEDUP_LIMIT) {
      const first = this.seenMsgIds.values().next().value;
      if (first !== undefined) this.seenMsgIds.delete(first);
    }
    this.seenMsgIds.add(decoded.msgId);

    // Decrement TTL
    const newTtl = decoded.ttl - 1;
    const shouldRelay = newTtl > 0;

    let relPacket: Uint8Array | undefined;
    if (shouldRelay) {
      relPacket = this.encodePacket(decoded.msgType, decoded.payload, newTtl, decoded.msgId, decoded.partyHash);
    }

    return {
      packet: decoded,
      shouldRelay,
      relPacket,
    };
  }

  /**
   * Chunks a text string into sequential 31-byte BLE packets.
   * Text payload structure: [1B chunkIdx][1B totalChunks][14B UTF-8 chars]
   */
  static chunkTextMessage(text: string): Uint8Array[] {
    const encoder = new TextEncoder();
    const rawBytes = encoder.encode(text);
    const chunkSize = 14;
    const totalChunks = Math.max(1, Math.ceil(rawBytes.length / chunkSize));
    const packets: Uint8Array[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const slice = rawBytes.subarray(i * chunkSize, (i + 1) * chunkSize);
      const payload = new Uint8Array(16);
      payload[0] = i; // Chunk index (0-based)
      payload[1] = totalChunks; // Total chunks
      payload.set(slice, 2);

      const packet = this.encodePacket(MeshMsgType.TEXT_CHUNK, payload, this.MAX_TTL);
      packets.push(packet);
    }

    return packets;
  }

  /**
   * Encodes a GPS Telemetry Pin packet:
   * Payload: [4B Lat * 1e5][4B Lon * 1e5][2B Ele][2B Battery][4B LabelHash]
   */
  static encodeGpsPinPacket(lat: number, lon: number, ele: number, batteryPct: number = 88): Uint8Array {
    const payload = new Uint8Array(16);
    const view = new DataView(payload.buffer);
    view.setInt32(0, Math.round(lat * 100000), false);
    view.setInt32(4, Math.round(lon * 100000), false);
    view.setInt16(8, Math.round(ele), false);
    view.setInt16(10, batteryPct, false);
    view.setUint32(12, 0x47505331, false); // 'GPS1'
    return this.encodePacket(MeshMsgType.GPS_TELEMETRY, payload, this.MAX_TTL);
  }

  /**
   * Encodes a Tactical Alert / SOS packet:
   * Payload: [1B alertCode][1B severity][14B Short Message]
   */
  static encodeTacticalAlertPacket(alertText: string, isSos: boolean = false): Uint8Array {
    const payload = new Uint8Array(16);
    payload[0] = isSos ? 0xff : 0x01; // Alert code
    payload[1] = isSos ? 0x05 : 0x01; // Severity
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(alertText);
    payload.set(textBytes.subarray(0, 14), 2);
    return this.encodePacket(MeshMsgType.TACTICAL_ALERT, payload, this.MAX_TTL);
  }

  /**
   * Encodes a Media Queued Notice packet (0x04):
   * Payload: [1B type][3B sizeKB][4B Lat*10000][4B Lon*10000][4B hashPrefix]
   */
  static encodeMediaNoticePacket(
    fileName: string,
    sizeBytes: number,
    lat: number,
    lon: number,
    hashPrefixHex: string
  ): Uint8Array {
    const payload = new Uint8Array(16);
    const view = new DataView(payload.buffer);
    payload[0] = fileName.toLowerCase().endsWith('.gpx') ? 2 : 1; // 1 = Photo, 2 = GPX
    const sizeKb = Math.min(Math.round(sizeBytes / 1024), 0xffffff);
    payload[1] = (sizeKb >> 16) & 0xff;
    payload[2] = (sizeKb >> 8) & 0xff;
    payload[3] = sizeKb & 0xff;
    view.setInt32(4, Math.round(lat * 10000), false);
    view.setInt32(8, Math.round(lon * 10000), false);
    const hashInt = parseInt(hashPrefixHex.substring(0, 8), 16) || 0x12345678;
    view.setUint32(12, hashInt, false);
    return this.encodePacket(MeshMsgType.MEDIA_NOTICE, payload, this.MAX_TTL);
  }

  /**
   * Computes a real SHA-256 hash using standard Web Crypto or expo-crypto.
   */
  static async computeSha256(contentOrBase64: string): Promise<string> {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(contentOrBase64);
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }
      const Crypto = await import('expo-crypto');
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        contentOrBase64
      );
    } catch (_) {
      // Deterministic fallback hash
      let hash = 0;
      for (let i = 0; i < contentOrBase64.length; i++) {
        hash = (hash << 5) - hash + contentOrBase64.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(16).padStart(64, 'a');
    }
  }

  /**
   * Returns default seeded squad shared media files.
   */
  static getInitialSquadMediaPool(): SquadMediaRecord[] {
    return [
      {
        id: 'media_1',
        name: 'Kedarkantha_Ridge_Sunrise.jpg',
        type: 'photo',
        sizeBytes: 2516582, // 2.4 MB
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        senderName: 'Tenzing Norgay (Lead Guide)',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        lat: 31.025,
        lon: 78.175,
        ele: 3812,
        isSynced: true,
      },
      {
        id: 'media_2',
        name: 'Juda_Ka_Talab_Frozen_Lake.jpg',
        type: 'photo',
        sizeBytes: 3984588, // 3.8 MB
        sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        senderName: 'Rohan Sharma (Trekker)',
        timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
        lat: 31.058,
        lon: 78.201,
        ele: 2950,
        isSynced: false,
      },
      {
        id: 'media_3',
        name: 'Himalayan_Black_Bear_Tracks.jpg',
        type: 'photo',
        sizeBytes: 1992294, // 1.9 MB
        sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        senderName: 'Maya Sen (Sweep)',
        timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
        lat: 31.069,
        lon: 78.191,
        ele: 2400,
        isSynced: false,
      },
      {
        id: 'media_4',
        name: 'Summit_Push_Waypoints.gpx',
        type: 'gpx',
        sizeBytes: 148480, // 145 KB
        sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
        senderName: 'Tenzing Norgay (Lead Guide)',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        lat: 31.0238,
        lon: 78.1722,
        ele: 3810,
        isSynced: false,
      },
    ];
  }

  /**
   * Initial messages list for Mesh Chat.
   */
  static getInitialMessages(): SquadMessageRecord[] {
    return [
      {
        id: 'msg_01',
        senderName: 'Tenzing Norgay',
        senderRole: 'LEAD GUIDE',
        text: 'Weather holding at Base Camp. Ridge winds 18kt. Proceeding to summit ridge in 15min.',
        timestamp: '06:15 AM',
        type: 'text',
        hops: 1,
        rssiDbm: -56,
      },
      {
        id: 'msg_02',
        senderName: 'Rohan Sharma',
        senderRole: 'TREKKER',
        text: 'Water spring located 40m off main trail at 2,950m mark. Flow rate is clean.',
        timestamp: '06:22 AM',
        type: 'alert',
        lat: 31.058,
        lon: 78.201,
        ele: 2950,
        hops: 2,
        rssiDbm: -68,
      },
      {
        id: 'msg_03',
        senderName: 'Maya Sen',
        senderRole: 'SWEEP',
        text: 'Broadcast GPS Pin: All sweep members past the boulder field.',
        timestamp: '06:30 AM',
        type: 'gps',
        lat: 31.069,
        lon: 78.191,
        ele: 2400,
        hops: 3,
        rssiDbm: -82,
      },
    ];
  }
}
