import { describe, it, expect } from 'bun:test';
import { MeshService, MeshMsgType } from '../services/meshService';

describe('MeshService 31-byte BLE Packet Protocol', () => {
  it('correctly encodes and decodes standard 31-byte packet', () => {
    const payload = new Uint8Array(16);
    payload.fill(0xaa);

    const packet = MeshService.encodePacket(MeshMsgType.TACTICAL_ALERT, payload, 4, 12345, 0xa1b2c3d4);
    expect(packet.length).toBe(31);

    const decoded = MeshService.decodePacket(packet);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.length).toBe(31);
      expect(decoded.msgType).toBe(MeshMsgType.TACTICAL_ALERT);
      expect(decoded.ttl).toBe(4);
      expect(decoded.msgId).toBe(12345);
      expect(decoded.partyHash).toBe(0xa1b2c3d4);
      expect(decoded.payload.length).toBe(16);
      expect(decoded.payload[0]).toBe(0xaa);
    }
  });

  it('correctly chunks long text strings and preserves chunks', () => {
    const text = 'Ridge winds gusting 22kt. Approach summit north shoulder cautiously.';
    const packets = MeshService.chunkTextMessage(text);

    expect(packets.length).toBeGreaterThan(1);
    for (const pkt of packets) {
      expect(pkt.length).toBe(31);
      const dec = MeshService.decodePacket(pkt);
      expect(dec).not.toBeNull();
      expect(dec?.msgType).toBe(MeshMsgType.TEXT_CHUNK);
    }
  });

  it('correctly encodes GPS Telemetry Pin into fixed binary payload', () => {
    const lat = 31.0255;
    const lon = 78.1748;
    const ele = 3812;
    const battery = 88;

    const packet = MeshService.encodeGpsPinPacket(lat, lon, ele, battery);
    expect(packet.length).toBe(31);

    const decoded = MeshService.decodePacket(packet);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.msgType).toBe(MeshMsgType.GPS_TELEMETRY);
      const view = new DataView(decoded.payload.buffer, decoded.payload.byteOffset, 16);
      const decLat = view.getInt32(0, false) / 100000;
      const decLon = view.getInt32(4, false) / 100000;
      const decEle = view.getInt16(8, false);
      const decBattery = view.getInt16(10, false);

      expect(decLat).toBeCloseTo(lat, 4);
      expect(decLon).toBeCloseTo(lon, 4);
      expect(decEle).toBe(ele);
      expect(decBattery).toBe(battery);
    }
  });

  it('drops duplicate packets and decrements TTL for multi-hop relay', () => {
    const payload = new Uint8Array(16);
    payload[0] = 0x42;

    const uniqueMsgId = 998877;
    const initialPacket = MeshService.encodePacket(MeshMsgType.TEXT_CHUNK, payload, 3, uniqueMsgId);

    // 1st receipt: valid relay, TTL decremented
    const result1 = MeshService.processIncomingPacket(initialPacket);
    expect(result1).not.toBeNull();
    expect(result1?.shouldRelay).toBe(true);

    if (result1?.relPacket) {
      const relayedDecoded = MeshService.decodePacket(result1.relPacket);
      expect(relayedDecoded?.ttl).toBe(2);
      expect(relayedDecoded?.msgId).toBe(uniqueMsgId);
    }

    // 2nd receipt (duplicate): must be dropped by LRU deduplication
    const result2 = MeshService.processIncomingPacket(initialPacket);
    expect(result2).toBeNull();
  });
});
