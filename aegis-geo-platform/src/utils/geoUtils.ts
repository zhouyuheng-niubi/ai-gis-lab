export function generateMockCityBuildings(centerLng: number, centerLat: number, rings: number = 8) {
  const buildings = [];
  const spacingLng = 0.0015; 
  const spacingLat = 0.0012; 
  const buildingSizeLng = 0.0008;
  const buildingSizeLat = 0.0006;

  for (let x = -rings; x <= rings; x++) {
    for (let y = -rings; y <= rings; y++) {
      const distance = Math.sqrt(x*x + y*y);
      if (distance > rings) continue; // Circular city footprint

      // "Streets" cut out
      if (Math.abs(x) % 3 === 0 || Math.abs(y) % 3 === 0) {
        if (Math.random() > 0.4) continue;
      }

      // 80% chance to spawn a building on a valid lot
      if (Math.random() > 0.2) {
        // Jitter position slightly
        const blng = centerLng + x * spacingLng + (Math.random() * 0.0003);
        const blat = centerLat + y * spacingLat + (Math.random() * 0.0003);
        
        let height = 0;
        if (distance < rings * 0.25) {
          // City Core: Skyscrapers
          height = 80 + Math.random() * 120; 
          // 5% chance of a landmark super-structure
          if (Math.random() > 0.95) height = 250 + Math.random() * 100;
        } else if (distance < rings * 0.6) {
          // Mid-town
          height = 30 + Math.random() * 60;
        } else {
          // Suburbs / Outer rim
          height = 10 + Math.random() * 20;
        }
        
        buildings.push({
          id: `bld-${x}-${y}`,
          height: height,
          polygon: [
            [blng, blat],
            [blng + buildingSizeLng, blat],
            [blng + buildingSizeLng, blat + buildingSizeLat],
            [blng, blat + buildingSizeLat]
          ]
        });
      }
    }
  }

  return buildings;
}
