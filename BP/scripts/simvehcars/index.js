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

world.afterEvents.playerSpawn.subscribe(
    (event) => {
        if (!event.initialSpawn) return
        const { player } = event;

        player.setDynamicProperty(SimVehCarsBook, true)
        if (player.getDynamicProperty(SimVehCarsBook)) return;
        player.sendMessage("This Simple Vehicles Add-on: CARS Requires Base Version of Simple Vehicles Add-On")

        player.setDynamicProperty(SimVehCarsBook, false);
    }
);