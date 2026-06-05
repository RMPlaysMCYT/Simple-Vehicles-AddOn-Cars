import { world, system } from "@minecraft/server";

import {SimVehCars_Car} from './car.js';

const vehicleLists = [
    "simvehcars:compact_car"
]

world.afterEvents.playerInteractWithEntity.subscribe(({player, target: entity}) => {
    if (vehicleLists.includes(entity.typeId)){
        if(!player.isSneaking) {
            entity.getComponent("rideable").addRider(player)
            new SimVehCars_Car(entity, player)
        }
    }
})
