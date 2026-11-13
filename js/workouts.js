        // =========================================================================
        // 1. PRESET WORKOUTS & ZWIFT (.ZWO) XML PARSER
        // =========================================================================
        const PRESET_WORKOUTS = {
            kickr_arcade: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Arcade</author>
    <name>KICKR Arcade Pyramid</name>
    <description>Progressive watt accuracy pyramid flying through 3D Sky Donut Gates.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="90" PowerLow="0.50" PowerHigh="0.70"/>
        <SteadyState Duration="90" Power="0.75"/>
        <SteadyState Duration="90" Power="0.88"/>
        <SteadyState Duration="60" Power="1.00"/>
        <SteadyState Duration="90" Power="0.88"/>
        <SteadyState Duration="90" Power="0.75"/>
        <Cooldown Duration="90" PowerLow="0.70" PowerHigh="0.50"/>
    </workout>
</workout_file>`,
            sky_sine_ramps: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Sky Master</author>
    <name>Sky Serpent Up &amp; Down Ramps</name>
    <description>Continuous ascending and descending watt ramps where the 3D donut gates weave smoothly up and down through the clouds.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="45" PowerLow="0.50" PowerHigh="0.76"/>
        <Ramp Duration="45" PowerLow="0.76" PowerHigh="1.05"/>
        <Ramp Duration="40" PowerLow="1.05" PowerHigh="0.62"/>
        <Ramp Duration="45" PowerLow="0.62" PowerHigh="1.15"/>
        <Ramp Duration="40" PowerLow="1.15" PowerHigh="0.58"/>
        <Ramp Duration="50" PowerLow="0.58" PowerHigh="1.22"/>
        <SteadyState Duration="20" Power="1.22"/>
        <Ramp Duration="45" PowerLow="1.22" PowerHigh="0.55"/>
        <Ramp Duration="45" PowerLow="0.55" PowerHigh="1.08"/>
        <Ramp Duration="35" PowerLow="1.08" PowerHigh="0.72"/>
        <Ramp Duration="45" PowerLow="0.72" PowerHigh="1.26"/>
        <Ramp Duration="45" PowerLow="1.26" PowerHigh="0.60"/>
        <Ramp Duration="50" PowerLow="0.60" PowerHigh="1.18"/>
        <Ramp Duration="40" PowerLow="1.18" PowerHigh="0.66"/>
        <Ramp Duration="45" PowerLow="0.66" PowerHigh="1.30"/>
        <Ramp Duration="50" PowerLow="1.30" PowerHigh="0.54"/>
        <Ramp Duration="45" PowerLow="0.54" PowerHigh="1.12"/>
        <Ramp Duration="40" PowerLow="1.12" PowerHigh="0.68"/>
        <Ramp Duration="35" PowerLow="0.68" PowerHigh="1.24"/>
        <Cooldown Duration="55" PowerLow="1.24" PowerHigh="0.46"/>
    </workout>
</workout_file>`,
            alpine_switchback_ramps: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Alpine</author>
    <name>Alpine Switchback Double Ramps</name>
    <description>Multi-stage mountain switchbacks combining double upward power ramps, summit sprints, and steep downward descent ramps.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="60" PowerLow="0.48" PowerHigh="0.74"/>
        <Ramp Duration="45" PowerLow="0.74" PowerHigh="0.96"/>
        <Ramp Duration="40" PowerLow="0.96" PowerHigh="1.18"/>
        <SteadyState Duration="20" Power="1.24"/>
        <Ramp Duration="50" PowerLow="1.24" PowerHigh="0.58"/>
        <Ramp Duration="45" PowerLow="0.58" PowerHigh="0.92"/>
        <Ramp Duration="35" PowerLow="0.92" PowerHigh="0.72"/>
        <Ramp Duration="45" PowerLow="0.72" PowerHigh="1.14"/>
        <Ramp Duration="35" PowerLow="1.14" PowerHigh="1.30"/>
        <Ramp Duration="55" PowerLow="1.30" PowerHigh="0.54"/>
        <SteadyState Duration="25" Power="0.85"/>
        <Ramp Duration="45" PowerLow="0.85" PowerHigh="1.20"/>
        <Ramp Duration="40" PowerLow="1.20" PowerHigh="0.66"/>
        <Ramp Duration="45" PowerLow="0.66" PowerHigh="1.06"/>
        <Ramp Duration="40" PowerLow="1.06" PowerHigh="1.28"/>
        <Ramp Duration="50" PowerLow="1.28" PowerHigh="0.56"/>
        <Ramp Duration="45" PowerLow="0.56" PowerHigh="0.98"/>
        <Ramp Duration="35" PowerLow="0.98" PowerHigh="0.70"/>
        <Ramp Duration="45" PowerLow="0.70" PowerHigh="1.22"/>
        <Ramp Duration="45" PowerLow="1.22" PowerHigh="0.62"/>
        <Ramp Duration="40" PowerLow="0.62" PowerHigh="1.34"/>
        <Cooldown Duration="65" PowerLow="1.34" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            mach_dive_climb_level: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Arcade</author>
    <name>Mach Canyon Dive &amp; Climb Level</name>
    <description>High-speed canyon level featuring sharp V-dive ramps (high-to-low-to-high) and inverted apex climb/dive ramps.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="45" PowerLow="0.52" PowerHigh="0.82"/>
        <SteadyState Duration="25" Power="1.12"/>
        <Ramp Duration="35" PowerLow="1.12" PowerHigh="0.56"/>
        <Ramp Duration="35" PowerLow="0.56" PowerHigh="1.20"/>
        <SteadyState Duration="20" Power="1.20"/>
        <Ramp Duration="35" PowerLow="1.20" PowerHigh="0.60"/>
        <Ramp Duration="40" PowerLow="0.60" PowerHigh="1.28"/>
        <Ramp Duration="35" PowerLow="1.28" PowerHigh="0.54"/>
        <SteadyState Duration="25" Power="0.86"/>
        <Ramp Duration="35" PowerLow="0.86" PowerHigh="1.18"/>
        <Ramp Duration="30" PowerLow="1.18" PowerHigh="0.68"/>
        <Ramp Duration="35" PowerLow="0.68" PowerHigh="1.26"/>
        <Ramp Duration="40" PowerLow="1.26" PowerHigh="0.52"/>
        <Ramp Duration="40" PowerLow="0.52" PowerHigh="1.15"/>
        <SteadyState Duration="25" Power="0.64"/>
        <Ramp Duration="35" PowerLow="0.64" PowerHigh="1.32"/>
        <Ramp Duration="35" PowerLow="1.32" PowerHigh="0.58"/>
        <Ramp Duration="35" PowerLow="0.58" PowerHigh="1.22"/>
        <Ramp Duration="35" PowerLow="1.22" PowerHigh="0.62"/>
        <Ramp Duration="30" PowerLow="0.62" PowerHigh="1.36"/>
        <Cooldown Duration="50" PowerLow="1.36" PowerHigh="0.46"/>
    </workout>
</workout_file>`,
            inferno_mega_ramps: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Boss Level</author>
    <name>Dragon Boss Mega-Ramp Gauntlet</name>
    <description>Ultimate 24-ramp gauntlet with relentless ascending and descending watt slopes across every training zone.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="50" PowerLow="0.50" PowerHigh="0.80"/>
        <Ramp Duration="35" PowerLow="0.80" PowerHigh="1.10"/>
        <Ramp Duration="30" PowerLow="1.10" PowerHigh="0.64"/>
        <Ramp Duration="35" PowerLow="0.64" PowerHigh="1.18"/>
        <Ramp Duration="30" PowerLow="1.18" PowerHigh="0.58"/>
        <Ramp Duration="40" PowerLow="0.58" PowerHigh="1.26"/>
        <Ramp Duration="35" PowerLow="1.26" PowerHigh="0.70"/>
        <Ramp Duration="35" PowerLow="0.70" PowerHigh="1.04"/>
        <Ramp Duration="30" PowerLow="1.04" PowerHigh="0.54"/>
        <Ramp Duration="40" PowerLow="0.54" PowerHigh="1.30"/>
        <SteadyState Duration="20" Power="1.30"/>
        <Ramp Duration="40" PowerLow="1.30" PowerHigh="0.56"/>
        <Ramp Duration="35" PowerLow="0.56" PowerHigh="0.98"/>
        <Ramp Duration="30" PowerLow="0.98" PowerHigh="0.66"/>
        <Ramp Duration="35" PowerLow="0.66" PowerHigh="1.20"/>
        <Ramp Duration="35" PowerLow="1.20" PowerHigh="0.60"/>
        <Ramp Duration="40" PowerLow="0.60" PowerHigh="1.34"/>
        <Ramp Duration="35" PowerLow="1.34" PowerHigh="0.62"/>
        <Ramp Duration="35" PowerLow="0.62" PowerHigh="1.12"/>
        <Ramp Duration="30" PowerLow="1.12" PowerHigh="0.72"/>
        <Ramp Duration="35" PowerLow="0.72" PowerHigh="1.28"/>
        <Ramp Duration="35" PowerLow="1.28" PowerHigh="0.55"/>
        <Ramp Duration="35" PowerLow="0.55" PowerHigh="1.38"/>
        <Cooldown Duration="55" PowerLow="1.38" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            dragon_rollercoaster: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Sky Master</author>
    <name>Dragon Canyon Rollercoaster</name>
    <description>High-action 28-segment sky rollercoaster with rapid climbs, steep dives, up/down ramps, and sprint gates.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="45" PowerLow="0.48" PowerHigh="0.72"/>
        <SteadyState Duration="30" Power="0.88"/>
        <SteadyState Duration="25" Power="0.62"/>
        <Ramp Duration="30" PowerLow="0.62" PowerHigh="1.08"/>
        <Ramp Duration="25" PowerLow="1.08" PowerHigh="0.58"/>
        <SteadyState Duration="25" Power="1.18"/>
        <SteadyState Duration="30" Power="0.76"/>
        <SteadyState Duration="30" Power="0.96"/>
        <SteadyState Duration="20" Power="1.24"/>
        <Ramp Duration="35" PowerLow="1.24" PowerHigh="0.55"/>
        <Ramp Duration="40" PowerLow="0.65" PowerHigh="1.12"/>
        <Ramp Duration="25" PowerLow="1.12" PowerHigh="0.60"/>
        <SteadyState Duration="30" Power="0.92"/>
        <SteadyState Duration="25" Power="1.10"/>
        <SteadyState Duration="20" Power="1.28"/>
        <Ramp Duration="35" PowerLow="1.28" PowerHigh="0.56"/>
        <SteadyState Duration="30" Power="0.84"/>
        <SteadyState Duration="30" Power="1.02"/>
        <SteadyState Duration="25" Power="0.66"/>
        <SteadyState Duration="25" Power="1.16"/>
        <SteadyState Duration="30" Power="0.74"/>
        <Ramp Duration="40" PowerLow="0.70" PowerHigh="1.20"/>
        <Ramp Duration="30" PowerLow="1.20" PowerHigh="0.58"/>
        <SteadyState Duration="30" Power="0.95"/>
        <SteadyState Duration="25" Power="1.14"/>
        <SteadyState Duration="20" Power="1.32"/>
        <Ramp Duration="35" PowerLow="1.32" PowerHigh="0.64"/>
        <Cooldown Duration="50" PowerLow="0.68" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            criterium_chaos: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Pro Race</author>
    <name>Pro Criterium Corner Sprints</name>
    <description>Punchy city criterium simulation with 32 watt changes: explosive corner sprints and variable pack surges.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="60" PowerLow="0.50" PowerHigh="0.78"/>
        <SteadyState Duration="30" Power="0.92"/>
        <SteadyState Duration="20" Power="1.25"/>
        <SteadyState Duration="35" Power="0.68"/>
        <SteadyState Duration="20" Power="1.30"/>
        <SteadyState Duration="40" Power="0.84"/>
        <SteadyState Duration="30" Power="1.04"/>
        <SteadyState Duration="20" Power="1.28"/>
        <SteadyState Duration="40" Power="0.60"/>
        <SteadyState Duration="35" Power="0.96"/>
        <SteadyState Duration="25" Power="1.18"/>
        <SteadyState Duration="35" Power="0.74"/>
        <SteadyState Duration="20" Power="1.34"/>
        <SteadyState Duration="45" Power="0.58"/>
        <Ramp Duration="45" PowerLow="0.72" PowerHigh="1.15"/>
        <SteadyState Duration="25" Power="0.65"/>
        <SteadyState Duration="30" Power="1.08"/>
        <SteadyState Duration="20" Power="1.32"/>
        <SteadyState Duration="35" Power="0.78"/>
        <SteadyState Duration="35" Power="0.94"/>
        <SteadyState Duration="20" Power="1.26"/>
        <SteadyState Duration="40" Power="0.62"/>
        <SteadyState Duration="35" Power="0.88"/>
        <SteadyState Duration="30" Power="1.06"/>
        <SteadyState Duration="25" Power="1.22"/>
        <SteadyState Duration="35" Power="0.70"/>
        <SteadyState Duration="30" Power="0.98"/>
        <SteadyState Duration="20" Power="1.36"/>
        <SteadyState Duration="40" Power="0.64"/>
        <SteadyState Duration="30" Power="1.12"/>
        <SteadyState Duration="25" Power="1.40"/>
        <Cooldown Duration="75" PowerLow="0.68" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            micro_burst_storm: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey HIIT Lab</author>
    <name>30/15 VO2max Micro-Burst Storm</name>
    <description>34 rapid-fire watt transitions combining 30/15 VO2max micro-bursts with mid-flight sawtooth steps.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="60" PowerLow="0.50" PowerHigh="0.75"/>
        <SteadyState Duration="30" Power="0.90"/>
        <SteadyState Duration="30" Power="0.60"/>
        <IntervalsT Repeat="7" OnDuration="30" OffDuration="15" OnPower="1.20" OffPower="0.56"/>
        <SteadyState Duration="45" Power="0.52"/>
        <SteadyState Duration="30" Power="0.78"/>
        <SteadyState Duration="30" Power="0.94"/>
        <SteadyState Duration="30" Power="1.08"/>
        <SteadyState Duration="30" Power="0.82"/>
        <SteadyState Duration="45" Power="0.55"/>
        <IntervalsT Repeat="7" OnDuration="30" OffDuration="15" OnPower="1.24" OffPower="0.54"/>
        <Cooldown Duration="60" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            sawtooth_alps: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Alpine</author>
    <name>Alpine Sawtooth Multi-Peak</name>
    <description>Four jagged alpine staircase climbs where each 40-second step ratchets the 3D donut gates higher into the sky.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="75" PowerLow="0.50" PowerHigh="0.72"/>
        <SteadyState Duration="45" Power="0.76"/>
        <SteadyState Duration="45" Power="0.88"/>
        <SteadyState Duration="40" Power="1.00"/>
        <SteadyState Duration="30" Power="1.15"/>
        <SteadyState Duration="50" Power="0.56"/>
        <SteadyState Duration="45" Power="0.78"/>
        <SteadyState Duration="45" Power="0.92"/>
        <SteadyState Duration="40" Power="1.04"/>
        <SteadyState Duration="30" Power="1.18"/>
        <SteadyState Duration="50" Power="0.58"/>
        <SteadyState Duration="45" Power="0.80"/>
        <SteadyState Duration="45" Power="0.94"/>
        <SteadyState Duration="40" Power="1.06"/>
        <SteadyState Duration="30" Power="1.22"/>
        <SteadyState Duration="55" Power="0.55"/>
        <SteadyState Duration="45" Power="0.82"/>
        <SteadyState Duration="45" Power="0.96"/>
        <SteadyState Duration="40" Power="1.08"/>
        <SteadyState Duration="30" Power="1.26"/>
        <SteadyState Duration="45" Power="0.62"/>
        <SteadyState Duration="35" Power="0.90"/>
        <SteadyState Duration="25" Power="1.12"/>
        <SteadyState Duration="20" Power="1.30"/>
        <SteadyState Duration="45" Power="0.60"/>
        <Cooldown Duration="60" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            tabata_inferno: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Blitz</author>
    <name>Dragon Fire Tabata Inferno</name>
    <description>Explosive 20s/20s anaerobic sky sprints interleaved with multi-step threshold stairs.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="60" PowerLow="0.50" PowerHigh="0.76"/>
        <SteadyState Duration="30" Power="0.92"/>
        <SteadyState Duration="30" Power="0.58"/>
        <IntervalsT Repeat="6" OnDuration="20" OffDuration="20" OnPower="1.30" OffPower="0.52"/>
        <SteadyState Duration="35" Power="0.72"/>
        <SteadyState Duration="35" Power="0.88"/>
        <SteadyState Duration="35" Power="1.04"/>
        <SteadyState Duration="35" Power="0.86"/>
        <SteadyState Duration="40" Power="0.56"/>
        <IntervalsT Repeat="6" OnDuration="20" OffDuration="20" OnPower="1.34" OffPower="0.50"/>
        <Cooldown Duration="60" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            endurance_wave_matrix: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Pro</author>
    <name>Harmonic Wave &amp; Step Matrix</name>
    <description>25-minute multi-zone wave matrix with 36 dynamic power changes across tempo, threshold, and VO2max.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="75" PowerLow="0.50" PowerHigh="0.74"/>
        <SteadyState Duration="40" Power="0.80"/>
        <SteadyState Duration="40" Power="0.92"/>
        <SteadyState Duration="35" Power="1.04"/>
        <SteadyState Duration="40" Power="0.86"/>
        <SteadyState Duration="40" Power="0.72"/>
        <SteadyState Duration="40" Power="0.88"/>
        <SteadyState Duration="35" Power="1.00"/>
        <SteadyState Duration="30" Power="1.14"/>
        <SteadyState Duration="40" Power="0.90"/>
        <SteadyState Duration="45" Power="0.64"/>
        <IntervalsT Repeat="5" OnDuration="35" OffDuration="25" OnPower="1.08" OffPower="0.82"/>
        <SteadyState Duration="45" Power="0.60"/>
        <Ramp Duration="50" PowerLow="0.68" PowerHigh="1.16"/>
        <SteadyState Duration="35" Power="0.74"/>
        <SteadyState Duration="35" Power="0.96"/>
        <SteadyState Duration="30" Power="1.12"/>
        <SteadyState Duration="25" Power="1.26"/>
        <SteadyState Duration="45" Power="0.62"/>
        <IntervalsT Repeat="4" OnDuration="30" OffDuration="20" OnPower="1.18" OffPower="0.76"/>
        <SteadyState Duration="35" Power="0.94"/>
        <SteadyState Duration="25" Power="1.28"/>
        <Cooldown Duration="75" PowerLow="0.68" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            sweet_spot: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Pro</author>
    <name>Sweet Spot Precision</name>
    <description>Hold steady Sweet Spot intervals within 5% of target watts for massive combo multipliers.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="120" PowerLow="0.50" PowerHigh="0.75"/>
        <IntervalsT Repeat="3" OnDuration="150" OffDuration="60" OnPower="0.90" OffPower="0.60"/>
        <Cooldown Duration="150" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            hiit_sprints: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Blitz</author>
    <name>Over-Under Surge Blitz</name>
    <description>Rapid altitude transitions between threshold and VO2max sky gates.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="120" PowerLow="0.50" PowerHigh="0.80"/>
        <IntervalsT Repeat="4" OnDuration="60" OffDuration="60" OnPower="1.08" OffPower="0.85"/>
        <Cooldown Duration="120" PowerLow="0.70" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            quick_blitz: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Arcade</author>
    <name>Quick 3-Minute Accuracy Sprint</name>
    <description>Fast 3-minute dragon flight challenge to test your Wahoo KICKR watt control.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="30" PowerLow="0.55" PowerHigh="0.75"/>
        <SteadyState Duration="45" Power="0.85"/>
        <SteadyState Duration="45" Power="1.00"/>
        <SteadyState Duration="30" Power="1.15"/>
        <Cooldown Duration="30" PowerLow="0.75" PowerHigh="0.50"/>
    </workout>
</workout_file>`,
            active_recovery_flush: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Active Recovery Flush (Z1)</name>
    <description>Low-strain Zone 1 spin (45–55% FTP) promoting capillary blood flow and metabolite clearance without neuromuscular fatigue.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="180" PowerLow="0.40" PowerHigh="0.50"/>
        <SteadyState Duration="300" Power="0.50"/>
        <SteadyState Duration="300" Power="0.55"/>
        <SteadyState Duration="240" Power="0.50"/>
        <Cooldown Duration="180" PowerLow="0.50" PowerHigh="0.40"/>
    </workout>
</workout_file>`,
            aerobic_zone2_base: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Mitochondrial Zone 2 Base</name>
    <description>Sustained Zone 2 endurance ride (65–73% FTP) to stimulate PGC-1α mitochondrial biogenesis, capillary density, and fat oxidation.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.65"/>
        <SteadyState Duration="480" Power="0.66"/>
        <SteadyState Duration="480" Power="0.70"/>
        <SteadyState Duration="480" Power="0.73"/>
        <SteadyState Duration="300" Power="0.68"/>
        <Cooldown Duration="180" PowerLow="0.65" PowerHigh="0.48"/>
    </workout>
</workout_file>`,
            polarised_lt1_endurance: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Polarized LT1 Aerobic Cruiser</name>
    <description>45-minute Seiler-inspired first-lactate-threshold (LT1) cruise at 68–75% FTP building durable Type I slow-twitch fiber efficiency.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="300" PowerLow="0.50" PowerHigh="0.68"/>
        <SteadyState Duration="540" Power="0.68"/>
        <SteadyState Duration="540" Power="0.72"/>
        <SteadyState Duration="540" Power="0.75"/>
        <SteadyState Duration="540" Power="0.70"/>
        <Cooldown Duration="240" PowerLow="0.68" PowerHigh="0.48"/>
    </workout>
</workout_file>`,
            sweet_spot_2x12: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>2×12m Sweet Spot Builder</name>
    <description>Classic 2×12-minute efforts at 88–92% FTP maximizing aerobic enzyme adaptation and muscular glycogen storage per unit of fatigue.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.78"/>
        <SteadyState Duration="360" Power="0.88"/>
        <SteadyState Duration="360" Power="0.92"/>
        <SteadyState Duration="240" Power="0.55"/>
        <SteadyState Duration="360" Power="0.89"/>
        <SteadyState Duration="360" Power="0.92"/>
        <Cooldown Duration="240" PowerLow="0.68" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            low_cadence_torque: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Muscular Force Tempo (SE)</name>
    <description>Sub-threshold tempo blocks (82–88% FTP) targeting high pedal torque and motor-unit recruitment to improve fatigue resistance.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="210" PowerLow="0.50" PowerHigh="0.75"/>
        <IntervalsT Repeat="4" OnDuration="240" OffDuration="90" OnPower="0.86" OffPower="0.58" Cadence="60" CadenceResting="90"/>
        <Cooldown Duration="180" PowerLow="0.68" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            lactate_clearance_over_unders: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>MCT1 Lactate Shuttle Over-Unders</name>
    <description>Alternates 2m at 92% FTP with 1m surges at 106% FTP to upregulate MCT1/MCT4 lactate transporters and clear lactate under load.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.82"/>
        <SteadyState Duration="60" Power="0.60"/>
        <IntervalsT Repeat="3" OnDuration="60" OffDuration="120" OnPower="1.06" OffPower="0.92"/>
        <SteadyState Duration="240" Power="0.55"/>
        <IntervalsT Repeat="3" OnDuration="60" OffDuration="120" OnPower="1.06" OffPower="0.92"/>
        <Cooldown Duration="240" PowerLow="0.70" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            classic_threshold_2x15: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>2×15m MLSS Threshold Cruise</name>
    <description>Sustained Maximal Lactate Steady State (98–100% FTP) intervals extending time-to-exhaustion (TTE) and raising functional threshold power.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.85"/>
        <SteadyState Duration="60" Power="0.58"/>
        <SteadyState Duration="900" Power="0.99"/>
        <SteadyState Duration="300" Power="0.55"/>
        <SteadyState Duration="900" Power="1.00"/>
        <Cooldown Duration="240" PowerLow="0.70" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            ronnestad_30_15_vo2: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Rønnestad 30/15 VO2max Blocks</name>
    <description>Proven Rønnestad protocol (3×9.5m of 30s at 120% FTP / 15s at 50% FTP) maximizing time spent above 90% VO2max and stroke volume.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.80"/>
        <SteadyState Duration="60" Power="0.55"/>
        <IntervalsT Repeat="10" OnDuration="30" OffDuration="15" OnPower="1.20" OffPower="0.50"/>
        <SteadyState Duration="180" Power="0.50"/>
        <IntervalsT Repeat="10" OnDuration="30" OffDuration="15" OnPower="1.20" OffPower="0.50"/>
        <Cooldown Duration="210" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            seiler_4x4_vo2max: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Norwegian 4×4m VO2max Cardiac</name>
    <description>Classic 4×4-minute intervals at 112% FTP with 3-minute recoveries proven to elevate maximal cardiac output and central O2 delivery.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="240" PowerLow="0.50" PowerHigh="0.82"/>
        <SteadyState Duration="60" Power="0.55"/>
        <IntervalsT Repeat="4" OnDuration="240" OffDuration="180" OnPower="1.12" OffPower="0.52"/>
        <Cooldown Duration="180" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            billat_hard_start_vo2: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Physiology</author>
    <name>Billat Fast-Start VO2 Kinetics</name>
    <description>4×3-minute intervals opening with 45s at 125% FTP settling to 108% FTP to accelerate VO2 kinetics and rapidly reach VO2max.</description>
    <sportType>bike</sportType>
    <workout>
        <Warmup Duration="210" PowerLow="0.50" PowerHigh="0.80"/>
        <SteadyState Duration="60" Power="0.55"/>
        <SteadyState Duration="45" Power="1.25"/>
        <SteadyState Duration="135" Power="1.08"/>
        <SteadyState Duration="150" Power="0.52"/>
        <SteadyState Duration="45" Power="1.25"/>
        <SteadyState Duration="135" Power="1.08"/>
        <SteadyState Duration="150" Power="0.52"/>
        <SteadyState Duration="45" Power="1.25"/>
        <SteadyState Duration="135" Power="1.08"/>
        <SteadyState Duration="150" Power="0.52"/>
        <SteadyState Duration="45" Power="1.25"/>
        <SteadyState Duration="135" Power="1.08"/>
        <Cooldown Duration="180" PowerLow="0.65" PowerHigh="0.45"/>
    </workout>
</workout_file>`,
            ftp_ramp_test_standard: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Testing Lab</author>
    <name>Standard MAP / FTP Ramp Test</name>
    <description>5m warmup (80–100W) then +20W steps every minute from 100W to 580W (estimates FTP up to 435W). Stop pedaling for 5s when spent — your new FTP (75% of best 1m power) is saved automatically.</description>
    <sportType>bike</sportType>
    <ftpTest>ramp</ftpTest>
    <workout>
        <Warmup Duration="300" PowerLow="80" PowerHigh="100"/>
        <SteadyState Duration="60" Power="100"/>
        <SteadyState Duration="60" Power="120"/>
        <SteadyState Duration="60" Power="140"/>
        <SteadyState Duration="60" Power="160"/>
        <SteadyState Duration="60" Power="180"/>
        <SteadyState Duration="60" Power="200"/>
        <SteadyState Duration="60" Power="220"/>
        <SteadyState Duration="60" Power="240"/>
        <SteadyState Duration="60" Power="260"/>
        <SteadyState Duration="60" Power="280"/>
        <SteadyState Duration="60" Power="300"/>
        <SteadyState Duration="60" Power="320"/>
        <SteadyState Duration="60" Power="340"/>
        <SteadyState Duration="60" Power="360"/>
        <SteadyState Duration="60" Power="380"/>
        <SteadyState Duration="60" Power="400"/>
        <SteadyState Duration="60" Power="420"/>
        <SteadyState Duration="60" Power="440"/>
        <SteadyState Duration="60" Power="460"/>
        <SteadyState Duration="60" Power="480"/>
        <SteadyState Duration="60" Power="500"/>
        <SteadyState Duration="60" Power="520"/>
        <SteadyState Duration="60" Power="540"/>
        <SteadyState Duration="60" Power="560"/>
        <SteadyState Duration="60" Power="580"/>
    </workout>
</workout_file>`,
            ftp_ramp_test_lite: `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
    <author>Loop Kicker Journey Testing Lab</author>
    <name>Lite / Finer-Step FTP Ramp Test (+10W)</name>
    <description>Gentle 4m warmup (80–100W) then +10W steps every minute from 100W to 560W (estimates FTP up to 420W). Finer steps for precise pacing — stops automatically 5s after exhaustion.</description>
    <sportType>bike</sportType>
    <ftpTest>ramp</ftpTest>
    <workout>
        <Warmup Duration="240" PowerLow="80" PowerHigh="100"/>
        <SteadyState Duration="60" Power="100"/>
        <SteadyState Duration="60" Power="110"/>
        <SteadyState Duration="60" Power="120"/>
        <SteadyState Duration="60" Power="130"/>
        <SteadyState Duration="60" Power="140"/>
        <SteadyState Duration="60" Power="150"/>
        <SteadyState Duration="60" Power="160"/>
        <SteadyState Duration="60" Power="170"/>
        <SteadyState Duration="60" Power="180"/>
        <SteadyState Duration="60" Power="190"/>
        <SteadyState Duration="60" Power="200"/>
        <SteadyState Duration="60" Power="210"/>
        <SteadyState Duration="60" Power="220"/>
        <SteadyState Duration="60" Power="230"/>
        <SteadyState Duration="60" Power="240"/>
        <SteadyState Duration="60" Power="250"/>
        <SteadyState Duration="60" Power="260"/>
        <SteadyState Duration="60" Power="270"/>
        <SteadyState Duration="60" Power="280"/>
        <SteadyState Duration="60" Power="290"/>
        <SteadyState Duration="60" Power="300"/>
        <SteadyState Duration="60" Power="310"/>
        <SteadyState Duration="60" Power="320"/>
        <SteadyState Duration="60" Power="330"/>
        <SteadyState Duration="60" Power="340"/>
        <SteadyState Duration="60" Power="350"/>
        <SteadyState Duration="60" Power="360"/>
        <SteadyState Duration="60" Power="370"/>
        <SteadyState Duration="60" Power="380"/>
        <SteadyState Duration="60" Power="390"/>
        <SteadyState Duration="60" Power="400"/>
        <SteadyState Duration="60" Power="410"/>
        <SteadyState Duration="60" Power="420"/>
        <SteadyState Duration="60" Power="430"/>
        <SteadyState Duration="60" Power="440"/>
        <SteadyState Duration="60" Power="450"/>
        <SteadyState Duration="60" Power="460"/>
        <SteadyState Duration="60" Power="470"/>
        <SteadyState Duration="60" Power="480"/>
        <SteadyState Duration="60" Power="490"/>
        <SteadyState Duration="60" Power="500"/>
        <SteadyState Duration="60" Power="510"/>
        <SteadyState Duration="60" Power="520"/>
        <SteadyState Duration="60" Power="530"/>
        <SteadyState Duration="60" Power="540"/>
        <SteadyState Duration="60" Power="550"/>
        <SteadyState Duration="60" Power="560"/>
    </workout>
</workout_file>`
        };

        function parseZwiftWorkoutXml(xmlText) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            const parserError = doc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Invalid Zwift XML format.');
            }

            const nameEl = doc.querySelector('workout_file > name, name');
            const authorEl = doc.querySelector('workout_file > author, author');
            const descEl = doc.querySelector('workout_file > description, description');
            const ftpTestEl = doc.querySelector('workout_file > ftpTest, ftpTest');
            const workoutEl = doc.querySelector('workout');

            if (!workoutEl) {
                throw new Error('No <workout> element found in Zwift file.');
            }

            const segments = [];
            const children = Array.from(workoutEl.children);

            function parseAttr(el, names, fallback) {
                for (const n of names) {
                    const val = el.getAttribute(n) ?? el.getAttribute(n.toLowerCase());
                    if (val !== null && val !== undefined && val !== '') {
                        const num = parseFloat(val);
                        if (!isNaN(num)) return num;
                    }
                }
                return fallback;
            }

            function formatPowerSpec(p, withFtpSuffix = false) {
                if (p <= 3.5) {
                    return `${Math.round(p * 100)}%${withFtpSuffix ? ' FTP' : ''}`;
                }
                return `${Math.round(p)}W`;
            }

            children.forEach((el) => {
                const tag = el.tagName.toLowerCase();
                if (tag === 'steadystate') {
                    const duration = Math.max(1, Math.round(parseAttr(el, ['Duration'], 60)));
                    const power = parseAttr(el, ['Power', 'PowerLow', 'PowerHigh'], 0.75);
                    const cadence = parseAttr(el, ['Cadence'], null);
                    segments.push({
                        type: 'SteadyState',
                        label: `Steady ${formatPowerSpec(power, true)}`,
                        duration,
                        startPower: power,
                        endPower: power,
                        cadence
                    });
                } else if (tag === 'warmup' || tag === 'cooldown' || tag === 'ramp') {
                    const duration = Math.max(1, Math.round(parseAttr(el, ['Duration'], 120)));
                    const powerLow = parseAttr(el, ['PowerLow', 'Power'], 0.50);
                    const powerHigh = parseAttr(el, ['PowerHigh', 'Power'], 0.75);
                    const rampDirLabel = powerHigh >= powerLow ? 'Ramp Up' : 'Ramp Down';
                    const labelPrefix = tag === 'warmup' ? 'Warmup' : (tag === 'cooldown' ? 'Cooldown' : rampDirLabel);
                    segments.push({
                        type: labelPrefix,
                        label: `${labelPrefix} (${formatPowerSpec(powerLow)} → ${formatPowerSpec(powerHigh)})`,
                        duration,
                        startPower: powerLow,
                        endPower: powerHigh,
                        cadence: parseAttr(el, ['Cadence'], null)
                    });
                } else if (tag === 'intervalst') {
                    const repeat = Math.max(1, Math.round(parseAttr(el, ['Repeat'], 1)));
                    const onDuration = Math.max(1, Math.round(parseAttr(el, ['OnDuration'], 60)));
                    const offDuration = Math.max(1, Math.round(parseAttr(el, ['OffDuration'], 60)));
                    const onPower = parseAttr(el, ['OnPower', 'PowerOnHigh', 'PowerOnLow'], 1.0);
                    const offPower = parseAttr(el, ['OffPower', 'PowerOffHigh', 'PowerOffLow'], 0.55);
                    for (let i = 1; i <= repeat; i++) {
                        segments.push({
                            type: 'Interval On',
                            label: `Interval ${i}/${repeat} ON`,
                            duration: onDuration,
                            startPower: onPower,
                            endPower: onPower,
                            cadence: parseAttr(el, ['Cadence'], null)
                        });
                        segments.push({
                            type: 'Interval Off',
                            label: `Interval ${i}/${repeat} Recovery`,
                            duration: offDuration,
                            startPower: offPower,
                            endPower: offPower,
                            cadence: parseAttr(el, ['CadenceResting'], null)
                        });
                    }
                } else if (tag === 'freeride' || tag === 'maxeffort') {
                    const duration = Math.max(1, Math.round(parseAttr(el, ['Duration'], 60)));
                    const power = tag === 'maxeffort' ? 1.25 : 0.75;
                    segments.push({
                        type: tag === 'maxeffort' ? 'Max Effort' : 'Free Ride',
                        label: tag === 'maxeffort' ? 'Max Effort Sprint' : 'Free Ride Zone',
                        duration,
                        startPower: power,
                        endPower: power,
                        cadence: null
                    });
                }
            });

            if (segments.length === 0) {
                throw new Error('Zwift file contains no supported workout intervals.');
            }

            let accumulated = 0;
            segments.forEach((seg, idx) => {
                seg.index = idx;
                seg.startSec = accumulated;
                seg.endSec = accumulated + seg.duration;
                accumulated = seg.endSec;
            });

            const parsedName = nameEl ? nameEl.textContent.trim() : 'Custom Zwift Workout';
            const explicitFtpTest = ftpTestEl && ftpTestEl.textContent.trim().toLowerCase() !== 'false';
            const inferredFtpTest = /\bramp\s*test\b|\bftp\s*test\b/i.test(parsedName);

            return {
                name: parsedName,
                author: authorEl ? authorEl.textContent.trim() : 'Zwift Athlete',
                description: descEl ? descEl.textContent.trim() : '',
                isFtpTest: Boolean(explicitFtpTest || inferredFtpTest),
                segments,
                totalDuration: accumulated
            };
        }

        function resolveWatts(powerVal, ftp) {
            if (powerVal <= 3.5) {
                return Math.max(25, Math.round(powerVal * ftp));
            }
            return Math.max(25, Math.round(powerVal));
        }

        function getBaseTargetWattsAtSecond(workout, sec, ftp) {
            if (!workout || workout.segments.length === 0) return 100;
            const clampedSec = Math.max(0, Math.min(sec, workout.totalDuration - 0.001));
            const seg = workout.segments.find(s => clampedSec >= s.startSec && clampedSec < s.endSec) || workout.segments[workout.segments.length - 1];
            const progress = seg.duration > 0 ? (clampedSec - seg.startSec) / seg.duration : 0;
            const interpPower = seg.startPower + (seg.endPower - seg.startPower) * progress;
            return resolveWatts(interpPower, ftp);
        }

        /**
         * Upwinds / Downwinds only affect the physical resistance (simulation grade / incline) sent to the
         * Wahoo KICKR and the 3D gate wind indicators; they do not modify the target watt values.
         */
        function getWindWattMultiplier(gradientPct) {
            return 1.0;
        }

        function getGradientPctAtSecond(sec) {
            if (!state.gradientProfile || state.gradientProfile.length === 0) {
                return state.currentGradientPct || 0.0;
            }
            const idx = Math.max(0, Math.min(state.gradientProfile.length - 1, Math.floor(sec)));
            return state.gradientProfile[idx].current || 0.0;
        }

        function getTargetWattsAtSecond(workout, sec, ftp) {
            return getBaseTargetWattsAtSecond(workout, sec, ftp);
        }

        function getActiveSegmentAtSecond(workout, sec) {
            if (!workout || workout.segments.length === 0) return null;
            const clampedSec = Math.max(0, Math.min(sec, workout.totalDuration - 0.001));
            return workout.segments.find(s => clampedSec >= s.startSec && clampedSec < s.endSec) || workout.segments[workout.segments.length - 1];
        }

