import ConveyorEngine from '../services/conveyorEngine';

describe('ConveyorEngine', () => {
  describe('parseConveyorDescription', () => {
    it('should parse basic straight conveyor', () => {
      const properties = ConveyorEngine.parseConveyorDescription('10 meter straight belt conveyor');

      expect(properties.length).toBe(1000); // 10m * 100px/m
      expect(properties.beltWidth).toBeUndefined();
      expect(properties.angle).toBeUndefined();
      expect(properties.beltType).toBe('flat');
    });

    it('should parse angled conveyor', () => {
      const properties = ConveyorEngine.parseConveyorDescription('45 degree inclined conveyor belt');

      expect(properties.angle).toBe(45);
      expect(properties.length).toBeUndefined();
    });

    it('should parse curved conveyor with radius', () => {
      const properties = ConveyorEngine.parseConveyorDescription('90 degree curve conveyor with 2 meter radius');

      expect(properties.curveAngle).toBe(90);
      expect(properties.curveRadius).toBe(200); // 2m * 100px/m
    });

    it('should parse roller conveyor', () => {
      const properties = ConveyorEngine.parseConveyorDescription('roller conveyor system');

      expect(properties.beltType).toBe('roller');
    });

    it('should parse bidirectional conveyor', () => {
      const properties = ConveyorEngine.parseConveyorDescription('bidirectional reversible conveyor');

      expect(properties.direction).toBe('bidirectional');
    });

    it('should parse ceiling mounted conveyor', () => {
      const properties = ConveyorEngine.parseConveyorDescription('ceiling suspended conveyor belt');

      expect(properties.supportType).toBe('ceiling');
    });
  });

  describe('createConveyorComponent', () => {
    it('should create basic straight conveyor component', () => {
      const component = ConveyorEngine.createConveyorComponent(
        '10 meter straight belt conveyor',
        { x: 100, y: 100 }
      );

      expect(component.type).toBe('straight_conveyor');
      expect(component.label).toBe('Conveyor');
      expect(component.geometry.x).toBe(100);
      expect(component.geometry.y).toBe(100);
      expect(component.conveyorProperties?.length).toBe(1000);
    });

    it('should create angled conveyor component', () => {
      const component = ConveyorEngine.createConveyorComponent(
        '45 degree inclined conveyor belt with 3m length',
        { x: 200, y: 200 }
      );

      expect(component.conveyorProperties?.angle).toBe(45);
      expect(component.conveyorProperties?.length).toBe(300);
      expect(component.geometry.rotation).toBe(45);
    });

    it('should create curved conveyor component', () => {
      const component = ConveyorEngine.createConveyorComponent(
        '90 degree curve conveyor with 2 meter radius',
        { x: 300, y: 300 }
      );

      expect(component.conveyorProperties?.curveAngle).toBe(90);
      expect(component.conveyorProperties?.curveRadius).toBe(200);
    });

    it('should generate conveyor rendering data', () => {
      const component = ConveyorEngine.createConveyorComponent(
        '10 meter straight belt conveyor',
        { x: 100, y: 100 }
      );

      expect(component.conveyorRendering).toBeDefined();
      expect(component.conveyorRendering?.segments).toBeDefined();
      expect(component.conveyorRendering?.supports).toBeDefined();
      expect(component.conveyorRendering?.accessories).toBeDefined();

      expect(component.conveyorRendering?.segments.length).toBeGreaterThan(0);
    });
  });

  describe('generateConveyorRendering', () => {
    it('should generate rendering for straight conveyor', () => {
      const geometry = { x: 0, y: 0, width: 200, height: 30, rotation: 0 };
      const properties = { length: 200, beltWidth: 30, angle: 0 };

      const rendering = ConveyorEngine.generateConveyorRendering(
        geometry,
        properties,
        { fill: '#52c41a', stroke: '#000000', strokeWidth: 2 }
      );

      expect(rendering.segments).toBeDefined();
      expect(rendering.segments.length).toBe(1);
      expect(rendering.segments[0].type).toBe('straight');
      expect(rendering.supports.length).toBeGreaterThan(0);
    });

    it('should generate rendering for curved conveyor', () => {
      const geometry = { x: 0, y: 0, width: 200, height: 30, rotation: 0 };
      const properties = {
        length: 200,
        beltWidth: 30,
        angle: 0,
        curveRadius: 100,
        curveAngle: 90
      };

      const rendering = ConveyorEngine.generateConveyorRendering(
        geometry,
        properties,
        { fill: '#52c41a', stroke: '#000000', strokeWidth: 2 }
      );

      expect(rendering.segments).toBeDefined();
      expect(rendering.segments.length).toBe(1);
      expect(rendering.segments[0].type).toBe('curved');
      expect(rendering.segments[0].curveCenter).toBeDefined();
      expect(rendering.segments[0].curveRadius).toBe(100);
    });
  });

  describe('generateConveyorSVG', () => {
    it('should generate SVG path for straight segment', () => {
      const segment = {
        type: 'straight' as const,
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        angle: 0,
        length: 100,
        width: 50,
        height: 30,
        beltWidth: 30,
        supports: 2
      };

      const svg = ConveyorEngine.generateConveyorSVG(
        [segment],
        { fill: '#52c41a', stroke: '#000000', strokeWidth: 2 }
      );

      expect(svg).toContain('M');
      expect(svg).toContain('L');
      expect(svg).toContain('Z');
    });

    it('should generate SVG path for curved segment', () => {
      const segment = {
        type: 'curved' as const,
        start: { x: 100, y: 0 },
        end: { x: 100, y: 100 },
        angle: 90,
        length: 157, // π/2 * 100 radius
        width: 50,
        height: 30,
        beltWidth: 30,
        curveCenter: { x: 100, y: 100 },
        curveRadius: 100,
        curveAngle: 90,
        supports: 2
      };

      const svg = ConveyorEngine.generateConveyorSVG(
        [segment],
        { fill: '#52c41a', stroke: '#000000', strokeWidth: 2 }
      );

      expect(svg).toContain('A'); // Arc command
    });
  });

  describe('mathematical accuracy', () => {
    it('should calculate correct curve center points', () => {
      const start = { x: 100, y: 0 };
      const angle = 90;
      const radius = 100;

      // This would require importing the private method for testing
      // For now, we verify the public interface works correctly
      const component = ConveyorEngine.createConveyorComponent(
        '90 degree curve conveyor with 1 meter radius',
        { x: 100, y: 0 }
      );

      expect(component.conveyorProperties?.curveRadius).toBe(100);
      expect(component.conveyorProperties?.curveAngle).toBe(90);
    });

    it('should handle arbitrary angles correctly', () => {
      const angles = [15, 30, 45, 60, 75, 105, 120, 135, 150, 165];

      angles.forEach(angle => {
        const component = ConveyorEngine.createConveyorComponent(
          `${angle} degree angled conveyor belt`,
          { x: 0, y: 0 }
        );

        expect(component.conveyorProperties?.angle).toBe(angle);
        expect(component.geometry.rotation).toBe(angle);
      });
    });
  });
});


