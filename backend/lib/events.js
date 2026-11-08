import { EventEmitter } from 'node:events';

// Bus event di memori untuk update realtime (Server-Sent Events).
// Cukup untuk satu proses backend; kalau nanti backend dijalankan lebih dari satu instance,
// ganti dengan Postgres LISTEN/NOTIFY.
const bus = new EventEmitter();
bus.setMaxListeners(100);

// type: 'kitchen:new' (pesanan baru masuk dapur), 'bill:changed' (bill dibuat/diubah/dibayar/status dapur)
export const publish = (type, data = {}) => bus.emit('event', { type, data, at: new Date().toISOString() });

export const subscribe = (fn) => {
    bus.on('event', fn);
    return () => bus.off('event', fn);
};
