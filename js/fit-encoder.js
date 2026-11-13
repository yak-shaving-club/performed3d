// =========================================================================
// 2. BINARY .FIT FILE ENCODER (GARMIN / STRAVA / TRAININGPEAKS COMPATIBLE)
// =========================================================================
const FIT_EPOCH_OFFSET_SEC = 631065600;

function computeFitCrc16(bytes, length) {
    const crcTable = [
        0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
        0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
    ];
    let crc = 0;
    for (let i = 0; i < length; i++) {
        const byte = bytes[i];
        let tmp = crcTable[crc & 0x0F];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[byte & 0x0F];
        tmp = crcTable[crc & 0x0F];
        crc = (crc >> 4) & 0x0FFF;
        crc = crc ^ tmp ^ crcTable[(byte >> 4) & 0x0F];
    }
    return crc & 0xFFFF;
}

function buildTrainingFitFile(sessionSummary, recordedSamples) {
    const bytes = [];
    function pushU8(v) { bytes.push(v & 0xFF); }
    function pushU16(v) { bytes.push(v & 0xFF, (v >> 8) & 0xFF); }
    function pushU32(v) {
        const u = v >>> 0;
        bytes.push(u & 0xFF, (u >> 8) & 0xFF, (u >> 16) & 0xFF, (u >> 24) & 0xFF);
    }
    function toFitTimestamp(unixMs) {
        return Math.max(0, Math.round(unixMs / 1000) - FIT_EPOCH_OFFSET_SEC);
    }

    const startFitTs = toFitTimestamp(sessionSummary.startTimeMs);
    const endFitTs = toFitTimestamp(sessionSummary.endTimeMs);

    const rawWorkoutName = (sessionSummary && sessionSummary.workoutName)
        ? String(sessionSummary.workoutName).trim()
        : 'Loop Kicker Journey Flight';
    const fitTitleStr = `Indoor Cycling Game - ${rawWorkoutName}`;
    const fitTitleRawBytes = typeof TextEncoder !== 'undefined'
        ? Array.from(new TextEncoder().encode(fitTitleStr))
        : Array.from(fitTitleStr).map(ch => ch.charCodeAt(0) & 0x7F);
    // Null-terminated UTF-8 string padded to an even byte length (max 64 bytes)
    const fitTitleMaxContent = Math.min(fitTitleRawBytes.length, 62);
    const fitTitleFieldSize = Math.max(2, (fitTitleMaxContent + 2) & ~1);
    const fitTitleBytes = new Uint8Array(fitTitleFieldSize);
    for (let i = 0; i < fitTitleMaxContent; i++) {
        fitTitleBytes[i] = fitTitleRawBytes[i];
    }

    function pushBytes(arr) {
        for (let i = 0; i < arr.length; i++) {
            bytes.push(arr[i] & 0xFF);
        }
    }

    function writeFileIdMsg() {
        pushU8(0x40 | 0); pushU8(0); pushU8(0); pushU16(0); pushU8(5);
        pushU8(4); pushU8(4); pushU8(0x86); // time_created (uint32)
        pushU8(1); pushU8(2); pushU8(0x84); // manufacturer (32 = Wahoo)
        pushU8(2); pushU8(2); pushU8(0x84); // product (1)
        pushU8(0); pushU8(1); pushU8(0x00); // type (4 = activity)
        pushU8(8); pushU8(fitTitleBytes.length); pushU8(0x07); // product_name (string)

        pushU8(0x00);
        pushU32(startFitTs);
        pushU16(32);
        pushU16(1);
        pushU8(4);
        pushBytes(fitTitleBytes);
    }

    function writeSportMsg() {
        pushU8(0x40 | 6); pushU8(0); pushU8(0); pushU16(12); pushU8(3);
        pushU8(3); pushU8(fitTitleBytes.length); pushU8(0x07); // name (string)
        pushU8(0); pushU8(1); pushU8(0x00); // sport (2 = cycling)
        pushU8(1); pushU8(1); pushU8(0x00); // sub_sport (6 = indoor_cycling)

        pushU8(0x06);
        pushBytes(fitTitleBytes);
        pushU8(2);
        pushU8(6);
    }

    function writeWorkoutMsg() {
        pushU8(0x40 | 5); pushU8(0); pushU8(0); pushU16(26); pushU8(4);
        pushU8(8);  pushU8(fitTitleBytes.length); pushU8(0x07); // wkt_name (string)
        pushU8(6);  pushU8(2); pushU8(0x84); // num_valid_steps (uint16)
        pushU8(4);  pushU8(1); pushU8(0x00); // sport (2 = cycling)
        pushU8(11); pushU8(1); pushU8(0x00); // sub_sport (6 = indoor_cycling)

        pushU8(0x05);
        pushBytes(fitTitleBytes);
        pushU16(0);
        pushU8(2);
        pushU8(6);
    }

    function writeRecordDef() {
        pushU8(0x40 | 1); pushU8(0); pushU8(0); pushU16(20); pushU8(6);
        pushU8(253); pushU8(4); pushU8(0x86);
        pushU8(5); pushU8(4); pushU8(0x86);
        pushU8(7); pushU8(2); pushU8(0x84);
        pushU8(6); pushU8(2); pushU8(0x84);
        pushU8(4); pushU8(1); pushU8(0x02);
        pushU8(3); pushU8(1); pushU8(0x02); // heart_rate (3, uint8, 0x02, bpm)
    }

    function toFitHeartRateByte(hr) {
        return (hr !== null && hr !== undefined && hr > 0)
            ? Math.max(1, Math.min(254, Math.round(hr)))
            : 0xFF;
    }

    function writeLapMsg() {
        pushU8(0x40 | 2); pushU8(0); pushU8(0); pushU16(19); pushU8(12);
        pushU8(253); pushU8(4); pushU8(0x86);
        pushU8(2);   pushU8(4); pushU8(0x86);
        pushU8(7);   pushU8(4); pushU8(0x86);
        pushU8(8);   pushU8(4); pushU8(0x86);
        pushU8(9);   pushU8(4); pushU8(0x86);
        pushU8(19);  pushU8(2); pushU8(0x84);
        pushU8(20);  pushU8(2); pushU8(0x84);
        pushU8(17);  pushU8(1); pushU8(0x02);
        pushU8(15);  pushU8(1); pushU8(0x02); // avg_heart_rate (bpm)
        pushU8(16);  pushU8(1); pushU8(0x02); // max_heart_rate (bpm)
        pushU8(25);  pushU8(1); pushU8(0x00); // sport (2 = cycling)
        pushU8(39);  pushU8(1); pushU8(0x00); // sub_sport (6 = indoor_cycling)

        pushU8(0x02);
        pushU32(endFitTs);
        pushU32(startFitTs);
        pushU32(Math.round(sessionSummary.durationSec * 1000));
        pushU32(Math.round(sessionSummary.durationSec * 1000));
        pushU32(Math.round(sessionSummary.totalDistanceMeters * 100));
        pushU16(Math.round(sessionSummary.avgWatts));
        pushU16(Math.round(sessionSummary.maxWatts));
        pushU8(Math.round(sessionSummary.avgCadence));
        pushU8(toFitHeartRateByte(sessionSummary.avgHeartRate));
        pushU8(toFitHeartRateByte(sessionSummary.maxHeartRate));
        pushU8(2); // cycling
        pushU8(6); // indoor_cycling
    }

    function writeSessionMsg() {
        pushU8(0x40 | 3); pushU8(0); pushU8(0); pushU16(18); pushU8(22);
        pushU8(253); pushU8(4); pushU8(0x86); // timestamp
        pushU8(2);   pushU8(4); pushU8(0x86); // start_time
        pushU8(7);   pushU8(4); pushU8(0x86); // total_elapsed_time (ms)
        pushU8(8);   pushU8(4); pushU8(0x86); // total_timer_time (ms)
        pushU8(9);   pushU8(4); pushU8(0x86); // total_distance (cm)
        pushU8(48);  pushU8(4); pushU8(0x86); // total_work (J)
        pushU8(20);  pushU8(2); pushU8(0x84); // avg_power (W)
        pushU8(21);  pushU8(2); pushU8(0x84); // max_power (W)
        pushU8(34);  pushU8(2); pushU8(0x84); // normalized_power (W)
        pushU8(35);  pushU8(2); pushU8(0x84); // training_stress_score (tss * 10)
        pushU8(36);  pushU8(2); pushU8(0x84); // intensity_factor (if * 1000)
        pushU8(45);  pushU8(2); pushU8(0x84); // threshold_power (W)
        pushU8(25);  pushU8(2); pushU8(0x84); // first_lap_index
        pushU8(26);  pushU8(2); pushU8(0x84); // num_laps
        pushU8(0);   pushU8(1); pushU8(0x00); // event (9 = session)
        pushU8(1);   pushU8(1); pushU8(0x00); // event_type (1 = stop)
        pushU8(18);  pushU8(1); pushU8(0x02); // avg_cadence (rpm)
        pushU8(16);  pushU8(1); pushU8(0x02); // avg_heart_rate (bpm)
        pushU8(17);  pushU8(1); pushU8(0x02); // max_heart_rate (bpm)
        pushU8(5);   pushU8(1); pushU8(0x00); // sport (2 = cycling)
        pushU8(6);   pushU8(1); pushU8(0x00); // sub_sport (6 = indoor_cycling)
        pushU8(110); pushU8(fitTitleBytes.length); pushU8(0x07); // sport_profile_name (string)

        pushU8(0x03);
        pushU32(endFitTs);
        pushU32(startFitTs);
        pushU32(Math.round(sessionSummary.durationSec * 1000));
        pushU32(Math.round(sessionSummary.durationSec * 1000));
        pushU32(Math.round(sessionSummary.totalDistanceMeters * 100));
        pushU32(Math.round(sessionSummary.totalWorkJoules));
        pushU16(Math.round(sessionSummary.avgWatts));
        pushU16(Math.round(sessionSummary.maxWatts));
        pushU16(Math.round(sessionSummary.normalizedPower));
        pushU16(Math.round(sessionSummary.tss * 10));
        pushU16(Math.round(sessionSummary.intensityFactor * 1000));
        pushU16(Math.round(sessionSummary.ftp));
        pushU16(0); // first_lap_index = 0
        pushU16(1); // num_laps = 1
        pushU8(9);  // event = session
        pushU8(1);  // event_type = stop
        pushU8(Math.round(sessionSummary.avgCadence));
        pushU8(toFitHeartRateByte(sessionSummary.avgHeartRate));
        pushU8(toFitHeartRateByte(sessionSummary.maxHeartRate));
        pushU8(2); // cycling
        pushU8(6); // indoor_cycling
        pushBytes(fitTitleBytes);
    }

    function writeActivityMsg() {
        pushU8(0x40 | 4); pushU8(0); pushU8(0); pushU16(34); pushU8(6);
        pushU8(253); pushU8(4); pushU8(0x86); // timestamp
        pushU8(0);   pushU8(4); pushU8(0x86); // total_timer_time (ms)
        pushU8(1);   pushU8(2); pushU8(0x84); // num_sessions
        pushU8(2);   pushU8(1); pushU8(0x00); // type (0 = manual)
        pushU8(3);   pushU8(1); pushU8(0x00); // event (26 = activity)
        pushU8(4);   pushU8(1); pushU8(0x00); // event_type (1 = stop)

        pushU8(0x04);
        pushU32(endFitTs);
        pushU32(Math.round(sessionSummary.durationSec * 1000));
        pushU16(1);
        pushU8(0);
        pushU8(26);
        pushU8(1);
    }

    writeFileIdMsg();
    writeSportMsg();
    writeWorkoutMsg();
    writeRecordDef();

    recordedSamples.forEach((sample) => {
        pushU8(0x01);
        pushU32(toFitTimestamp(sample.timestampMs));
        pushU32(Math.round(sample.distanceMeters * 100));
        pushU16(Math.max(0, Math.round(sample.actualWatts)));
        pushU16(Math.max(0, Math.round(sample.speedMps * 1000)));
        pushU8(Math.max(0, Math.min(254, Math.round(sample.cadence))));
        pushU8(toFitHeartRateByte(sample.heartRate));
    });

    writeLapMsg();
    writeSessionMsg();
    writeActivityMsg();

    const dataSize = bytes.length;
    const header = new Uint8Array(14);
    header[0] = 14;
    header[1] = 0x20;
    const profileVer = 2132;
    header[2] = profileVer & 0xFF;
    header[3] = (profileVer >> 8) & 0xFF;
    header[4] = dataSize & 0xFF;
    header[5] = (dataSize >> 8) & 0xFF;
    header[6] = (dataSize >> 16) & 0xFF;
    header[7] = (dataSize >> 24) & 0xFF;
    header[8] = 0x2E;
    header[9] = 0x46;
    header[10] = 0x49;
    header[11] = 0x54;
    const headerCrc = computeFitCrc16(header, 12);
    header[12] = headerCrc & 0xFF;
    header[13] = (headerCrc >> 8) & 0xFF;

    const fullBuffer = new Uint8Array(14 + dataSize + 2);
    fullBuffer.set(header, 0);
    fullBuffer.set(bytes, 14);
    const fileCrc = computeFitCrc16(fullBuffer, 14 + dataSize);
    fullBuffer[14 + dataSize] = fileCrc & 0xFF;
    fullBuffer[14 + dataSize + 1] = (fileCrc >> 8) & 0xFF;

    return fullBuffer;
}
