import { system, Entity, Player } from '@minecraft/server';

export class SimVehCars_Car {
    /** @param {Entity} entity @param {Player} player */
    constructor(entity, player) {
        this.player = player;
        this.entity = entity;
        // Property stored as 0-720 where 360 = neutral/straight
        this.steering = entity.getProperty("simvehcars:compact_car_steerotations") - 360;
        this.velocity = 0;
        this.rotSpeed = 0;
        this.loopedholes();
    }

    steering = 0;
    rotSpeed = 0;
    velocity = 0;

    // Tuning constants
    static MAX_STEER = 180;   // ±180 from neutral = full lock
    static STEER_RATE = 7;     // degrees added per tick while A/D held
    static MAX_SPEED = 0.65;
    static ACCELERATION = 0.04;
    static FRICTION = 0.025;
    static BRAKE_FORCE = 0.07;

    carData() {
        this.entity.setProperty(
            "simvehcars:compact_car_steerotations",
            Math.round(this.steering + 360)   // shift back to [0-720]
        );

        // Advance piston stroke animation based on speed (cycles 0-5)
        const strokeStep = Math.abs(this.velocity) > 0.01
            ? Math.round((Math.abs(this.velocity) / SimVehCars_Car.MAX_SPEED) * 5)
            : 0;
        this.entity.setProperty("simvehcars:stroke_type", strokeStep);

        // Delay prev-frame properties by 1 tick for smooth interpolation
        system.runTimeout(() => {
            this.entity.setProperty(
                "simvehcars:compact_car_steerotations_prev",
                Math.round(this.steering + 360)
            );
            this.entity.setProperty("simvehcars:stroke_type_rev", strokeStep);
        }, 1);
    }

    carBehaviores() {
        const entity = this.entity;

        // Bug fix #6: only guard on engine_type.
        // stroke_type == 0 is a valid idle position, not a "not installed" state.
        if (entity.getProperty("simvehcars:engine_type") == 0) return;

        const { x: steerInput, y: throttleInput } = this.player.inputInfo.getMovementVector();
        const throttle = Math.round(throttleInput / 1.2); // snap W/S to -1 / 0 / 1
        const view = entity.getViewDirection();
        const baseRot = entity.getRotation();

        // ── Steering ──────────────────────────────────────────────────────────
        if (steerInput !== 0) {
            if (this.rotSpeed < 10) this.rotSpeed += 1;
            // Bug fix #1: was (rot * this.rotationes).toFixed — function ref, not a call.
            // Result was NaN, making this.steering NaN every tick.
            this.steering += -(steerInput * this.rotSpeed);
        } else {
            this.rotSpeed = 0;
        }

        // Bug fix #4: clamp to full-lock limits (was completely missing)
        this.steering = Math.max(
            -SimVehCars_Car.MAX_STEER,
            Math.min(SimVehCars_Car.MAX_STEER, this.steering)
        );

        // Self-center when releasing input at low deflection
        if (this.steering > -7.5 && this.steering < 7.5 && this.rotSpeed === 0) {
            this.steering = 0;
        }

        // ── Throttle / speed ──────────────────────────────────────────────────
        // Bug fix #2 & #5: replaced this.sail_size (undefined) with actual throttle logic,
        // and actually apply the result so the car moves.
        if (throttle > 0) {
            this.velocity = Math.min(
                this.velocity + SimVehCars_Car.ACCELERATION,
                SimVehCars_Car.MAX_SPEED
            );
        } else if (throttle < 0) {
            // Brake first; reverse only once fully stopped
            if (this.velocity > 0.01) {
                this.velocity = Math.max(0, this.velocity - SimVehCars_Car.BRAKE_FORCE);
            } else {
                this.velocity = Math.max(
                    this.velocity - SimVehCars_Car.ACCELERATION,
                    -SimVehCars_Car.MAX_SPEED * 0.4  // reverse is slower
                );
            }
        } else {
            // Rolling friction — coast to a stop
            this.velocity += this.velocity > 0
                ? -Math.min(SimVehCars_Car.FRICTION, this.velocity)
                : Math.min(SimVehCars_Car.FRICTION, -this.velocity);
        }

        this.velocity = parseFloat(this.velocity.toFixed(3));

        // ── Apply movement ────────────────────────────────────────────────────
        if (this.velocity !== 0) {
            entity.applyKnockback(
                { x: view.x * (this.velocity / 20), z: view.z * (this.velocity / 20) },
                0
            );
        }

        // ── Yaw rotation (turn rate scales with speed, reverses when going backward) ──
        const steerNorm = this.steering / SimVehCars_Car.MAX_STEER;  // -1..+1
        const speedFactor = Math.abs(this.velocity) / SimVehCars_Car.MAX_SPEED; // 0..1
        const direction = Math.sign(this.velocity || 1);  // flip steering feel in reverse
        const turnRate = steerNorm * speedFactor * 3.5 * direction;

        entity.setRotation({ x: baseRot.x, y: baseRot.y + turnRate });
    }

    loopedholes() {
        const tasks = [
            () => this.carBehaviores(),
            () => this.carData()
        ];
        const runId = system.runInterval(() => {
            if (!this.entity.isValid) return system.clearRun(runId);
            if (this.entity.getComponent("rideable")?.getRiders().length === 0)
                return system.clearRun(runId);

            const tasksID = system.runJob((function* () {
                for (const task of tasks) yield task();
                system.clearJob(tasksID);
            })());
        });
    }
}