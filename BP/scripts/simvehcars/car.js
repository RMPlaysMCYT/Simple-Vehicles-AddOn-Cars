import { system, world, ItemStack, Entity, Player } from '@minecraft/server';

export class SimVehCars_Car {
    constructor(entity, player) {
        this.player = player;
        this.entity = entity;
        this.steering = entity.getProperty("simvehcars:compact_car_steerotations") - 360;
        this.stroke_type = entity.getProperty("simvehcars:stroke_type");
        this.loopedholes();
        this.velocity = 0;
    }

    steering = 0;
    rotationes = 0;
    stroke_type = 0;
    velocity = 0;

    carData() {
        this.entity.setProperty("simvehcars:compact_car_steerotations", Math.round(this.steering + 360))
        this.entity.setProperty("simvehcars:stroke_type", Math.round(this.stroke_type))
        system.runTimeout(() => {
            this.entity.setProperty("simvehcars:compact_car_steerotations_prev", Math.round(this.steering + 360));
            this.entity.setProperty("simvehcars:stroke_type_rev", Math.round(this.stroke_type))
        }, 1)
    }
    carBehaviores() {
        const entity = this.entity
        if (entity.getProperty("simvehcars:engine_type") == 0 || entity.getProperty("simvehcars:stroke_type") == 0) return;

        let { x: rot } = this.player.inputInfo.getMovementVector()

        const baseRotationes = entity.getRotation()

        const accelerationesRot = parseFloat((rot * this.rotationes).toFixed)
        !!rot
        ? this.rotationes < 10
            ? this.rotationes += 1
            : null
        : this.rotationes = 0
        this.steering += - accelerationesRot
        if (this.steering > -7.5 && this.steering < 7.5 && this.rotationes == 0) this.steering = 0

        const maxSpeed = Math.round((this.sail_size * Math.min(2.4, entity.getProperty("rebo:sail_type") * 1.41) / 2) / 5.6);
        const accelerationRate = 0.01;
    }


    loopedholes() {
        const tasks = [
            () => this.carBehaviores(),
            () => this.carData()
        ]
        const runId = system.runInterval(() => {
            if (!this.entity.isValid) return system.clearRun(runId)
            if (this.entity.getComponent("rideable").getRiders().length == 0) return system.clearRun(runId)
            const tasksIDs = system.runJob((function* () {
                for (const task of tasks) yield task();
                system.clearJob(tasksIDs)
            })())
        })
    }
}