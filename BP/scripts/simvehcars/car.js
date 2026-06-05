import { system, Entity, Player } from '@minecraft/server';

export class SimVehCars_Car {
    /** @param {Entity} entity @param {Player} player */
    constructor(entity, player) {
        this.player   = player;
        this.entity   = entity;
        this.steering = entity.getProperty("simvehcars:compact_car_steerotations") - 360;
        this.velocity = 0;
        this.rotSpeed = 0;
        this.loopedholes();
    }

    steering  = 0;
    rotSpeed  = 0;
    velocity  = 0;

    static MAX_STEER    = 180;
    static MAX_SPEED    = 0.65;
    static ACCELERATION = 0.04;
    static FRICTION     = 0.025;
    static BRAKE_FORCE  = 0.07;
    static RETURN_RATE  = 4;

    carData() {
        this.entity.setProperty(
            "simvehcars:compact_car_steerotations",
            Math.round(this.steering + 360)
        );

        const strokeStep = Math.abs(this.velocity) > 0.01
            ? Math.round((Math.abs(this.velocity) / SimVehCars_Car.MAX_SPEED) * 5)
            : 0;
        this.entity.setProperty("simvehcars:stroke_type", strokeStep);

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
        if (entity.getProperty("simvehcars:engine_type") == 0) return;

        const { x: steerInput, y: throttleInput } = this.player.inputInfo.getMovementVector();
        const throttle = Math.round(throttleInput / 1.2);
        const view     = entity.getViewDirection();
        const baseRot  = entity.getRotation();

        // ── Steering ──────────────────────────────────────────────────────────
        const acc = parseFloat((steerInput * this.rotSpeed).toFixed(1))
        !!steerInput
            ? this.rotSpeed < 10
                ? this.rotSpeed += 1
                : null
            : this.rotSpeed = 0
        this.steering += -acc

        if (this.steering >  SimVehCars_Car.MAX_STEER) this.steering =  SimVehCars_Car.MAX_STEER
        if (this.steering < -SimVehCars_Car.MAX_STEER) this.steering = -SimVehCars_Car.MAX_STEER

        if (this.steering > -7.5 && this.steering < 7.5 && this.rotSpeed == 0) this.steering = 0

        if (!steerInput && Math.abs(this.steering) > 7.5) {
            this.steering -= Math.sign(this.steering) * SimVehCars_Car.RETURN_RATE
        }

        // ── Throttle / speed ──────────────────────────────────────────────────
        if (throttle > 0) {
            this.velocity = Math.min(
                this.velocity + SimVehCars_Car.ACCELERATION,
                SimVehCars_Car.MAX_SPEED
            )
        } else if (throttle < 0) {
            if (this.velocity > 0.01) {
                this.velocity = Math.max(0, this.velocity - SimVehCars_Car.BRAKE_FORCE)
            } else {
                this.velocity = Math.max(
                    this.velocity - SimVehCars_Car.ACCELERATION,
                    -SimVehCars_Car.MAX_SPEED * 0.4
                )
            }
        } else {
            this.velocity += this.velocity > 0
                ? -Math.min(SimVehCars_Car.FRICTION, this.velocity)
                :  Math.min(SimVehCars_Car.FRICTION, -this.velocity)
        }

        this.velocity = parseFloat(this.velocity.toFixed(3))

        // ── Apply movement ────────────────────────────────────────────────────
        if (this.velocity !== 0) {
            // Fix: 1.x API takes 4 separate numbers, NOT an object.
            // 2.x style was: applyKnockback({ x: ..., z: ... }, strength)
            // 1.x style is:  applyKnockback(dirX, dirZ, hStrength, vStrength)
            entity.applyKnockback(
                view.x,              // directionX — normalized, from getViewDirection()
                view.z,              // directionZ
                this.velocity / 20,  // horizontalStrength
                0                    // verticalStrength
            )
        }

        // ── Yaw rotation ──────────────────────────────────────────────────────
        const steerNorm   = this.steering / SimVehCars_Car.MAX_STEER
        const speedFactor = Math.abs(this.velocity) / SimVehCars_Car.MAX_SPEED
        const direction   = Math.sign(this.velocity || 1)
        const turnRate    = steerNorm * speedFactor * 3.5 * direction

        entity.setRotation({ x: baseRot.x, y: baseRot.y + turnRate })
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