import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import { Material } from '@babylonjs/core/Materials/material';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { GameCore, CORAL_FUSE_SECONDS, type Entity, type GameEvent } from '../game/core';
import { TUNNEL_RADIUS, type Route } from '../game/layout';
import {
  v,
  add,
  sub,
  mul,
  norm,
  cross,
  dot,
  len,
  dist,
  mix,
  clamp,
  direction,
  seeded,
  closestOnPath,
  type V3,
} from '../game/math';
import { upgradeInfo, upgrades } from '../game/data';
import marine from '../../public/models/marine-manifest.json';

const bv = (p: V3) => new Vector3(p.x, p.y, p.z);
const color = (s: string) => Color3.FromHexString(s);
const look = (d: V3) =>
  Quaternion.RotationYawPitchRoll(Math.atan2(d.x, d.z), -Math.asin(clamp(d.y, -1, 1)), 0);
interface Fx {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
}

export class World {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FreeCamera;
  private containers = new Map<string, AssetContainer>();
  private oasis: TransformNode;
  private pipes: TransformNode;
  private boat: TransformNode;
  private fish: TransformNode;
  private propeller: TransformNode;
  private fill: PointLight;
  private shadow: ShadowGenerator;
  private entities = new Map<string, TransformNode>();
  private bulletMeshes: TransformNode[] = [];
  private fx: Fx[] = [];
  private materials = new Map<string, StandardMaterial>();
  private wall: StandardMaterial;
  private foliageRoots: TransformNode[] = [];
  private water: Mesh;
  private finishDiamond?: Mesh;
  private finishGlow?: GlowLayer;
  private time = 0;
  private renderedLayout: unknown;
  private quality = '';
  private sun: DirectionalLight;
  private ambient: HemisphericLight;
  private cameraReady = false;
  loadErrors: string[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    private game: GameCore,
  ) {
    this.engine = new Engine(
      canvas,
      true,
      { stencil: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' },
      false,
    );
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.065, 0.14, 0.18, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.004;
    this.scene.collisionsEnabled = false;
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('expedition-camera', new Vector3(48, 31, -50), this.scene);
    this.camera.inputs.clear();
    this.camera.minZ = 0.12;
    this.camera.maxZ = 1200;
    this.camera.fov = Math.PI / 2;
    this.ambient = new HemisphericLight('water-light', new Vector3(0.2, 1, -0.2), this.scene);
    this.ambient.intensity = 0.95;
    this.ambient.groundColor = new Color3(0.13, 0.2, 0.25);
    this.sun = new DirectionalLight('sun', new Vector3(-0.45, -1, 0.35), this.scene);
    this.sun.position = new Vector3(60, 95, -45);
    this.sun.intensity = 1.8;
    this.sun.diffuse = color('#ffe8bc');
    this.shadow = new ShadowGenerator(1024, this.sun);
    this.shadow.useBlurExponentialShadowMap = true;
    this.shadow.blurKernel = 12;
    this.shadow.darkness = 0.25;
    this.oasis = new TransformNode('oasis', this.scene);
    this.pipes = new TransformNode('tunnels', this.scene);
    this.boat = new TransformNode('batyskaf', this.scene);
    this.fish = new TransformNode('upgrade-fish', this.scene);
    this.propeller = new TransformNode('propeller', this.scene);
    this.propeller.parent = this.boat;
    this.propeller.position.z = -2.2;
    this.fill = new PointLight('hull-light', Vector3.Zero(), this.scene);
    this.fill.intensity = 0.55;
    this.fill.range = 55;
    this.fill.diffuse = color('#a2d5e1');
    this.wall = this.mat('wall', '#72897d');
    this.wall.backFaceCulling = false;
    this.wall.twoSidedLighting = false;
    this.wall.diffuseTexture = this.brickTexture();
    // Baked, unlit tunnel surfaces stay readable in every direction and quality preset.
    this.wall.disableLighting = true;
    this.wall.emissiveColor = Color3.White();
    this.wall.fogEnabled = false;
    this.wall.specularColor = new Color3(0.025, 0.025, 0.025);
    this.water = this.buildOasis();
  }
  private mat(name: string, hex: string, glow = 0, alpha = 1) {
    if (this.materials.has(name)) return this.materials.get(name)!;
    const m = new StandardMaterial(name, this.scene);
    m.diffuseColor = color(hex);
    m.specularColor = new Color3(0.08, 0.08, 0.08);
    m.emissiveColor = color(hex).scale(glow);
    m.alpha = alpha;
    this.materials.set(name, m);
    return m;
  }
  private attach(mesh: Mesh, parent: TransformNode, material: Material, position = v()) {
    mesh.parent = parent;
    mesh.material = material;
    mesh.position.copyFrom(bv(position));
    return mesh;
  }
  private brickTexture() {
    // One seamless atlas: broad ceramic pressure panels, teal seams and brass
    // fasteners. Transverse seams give optical flow; lengthwise rails show bends.
    const texture = new DynamicTexture(
      'marine-pressure-panels',
      { width: 512, height: 512 },
      this.scene,
      true,
    );
    const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
    const rng = seeded(27);
    ctx.fillStyle = '#b6c8c9';
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 2; row++) {
      const y = row * 256;
      const gradient = ctx.createLinearGradient(0, y, 0, y + 256);
      gradient.addColorStop(0, '#f1eee2');
      gradient.addColorStop(0.15, '#e4e8df');
      gradient.addColorStop(0.87, '#d8e2dd');
      gradient.addColorStop(1, '#c2d2cf');
      ctx.fillStyle = gradient;
      ctx.fillRect(30, y + 9, 470, 238);
      ctx.strokeStyle = '#a5bcbb';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, y + 23, 444, 210);
      ctx.fillStyle = '#f7f4e8';
      ctx.fillRect(31, y + 10, 468, 3);
      ctx.fillStyle = '#7e9e9f';
      ctx.fillRect(0, y, 512, 5);
      ctx.fillStyle = '#d7b679';
      ctx.fillRect(32, y + 6, 468, 3);
      for (const x of [53, 474])
        for (const dy of [36, 219]) {
          ctx.fillStyle = '#829c9d';
          ctx.beginPath();
          ctx.arc(x, y + dy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f6dba6';
          ctx.fillRect(x - 2, y + dy - 3, 4, 2);
        }
      // Broad, sparse chevrons can still be read while moving or on low quality.
      ctx.strokeStyle = '#729c9f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(208, y + 160);
      ctx.lineTo(256, y + 116);
      ctx.lineTo(304, y + 160);
      ctx.stroke();
      ctx.fillStyle = '#90adae';
      ctx.font = 'bold 17px monospace';
      ctx.fillText('B / 07', 353, y + 209);
    }
    ctx.fillStyle = '#5a8d96';
    ctx.fillRect(0, 0, 26, 512);
    ctx.fillStyle = '#a6d6d3';
    ctx.fillRect(4, 0, 18, 512);
    ctx.fillStyle = '#faffeb';
    ctx.fillRect(8, 0, 9, 512);
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(67,107,106,${rng() * 0.05})`;
      ctx.fillRect(35 + rng() * 460, rng() * 512, 1 + rng() * 2, 1);
    }
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.update();
    texture.anisotropicFilteringLevel = 8;
    return texture;
  }
  private ground() {
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [],
      uv: number[] = [];
    const rings = [10.3, 11.4, 15.4, 18, 27, 40, 58, 66],
      slices = 96;
    for (let r = 0; r < rings.length; r++)
      for (let i = 0; i <= slices; i++) {
        const a = (i / slices) * Math.PI * 2,
          radius = rings[r] * (r > 1 ? 1 + 0.012 * Math.sin(a * 7) : 1);
        const x = Math.cos(a) * radius,
          z = Math.sin(a) * radius;
        const y =
          r < 2
            ? 0.25
            : 0.5 +
              0.65 * Math.sin(a * 3 + 0.7) * Math.min(1, (radius - 12) / 15) +
              Math.max(0, radius - 45) * 0.025;
        positions.push(x, y, z);
        uv.push(x / 8, z / 8);
        const green = clamp((radius - 15 - Math.sin(a * 5) * 1.1) / 4, 0, 1);
        const sand = color('#d8c397'),
          grass = color('#6f9b4e');
        const c = Color3.Lerp(sand, grass, green).scale(0.94 + Math.sin(a * 11 + radius) * 0.055);
        colors.push(c.r, c.g, c.b, 1);
        if (r > 0 && i > 0) {
          const b = r * (slices + 1) + i,
            prev = b - slices - 1;
          indices.push(b, prev - 1, b - 1, b, prev, prev - 1);
        }
      }
    const mesh = new Mesh('island', this.scene),
      data = new VertexData(),
      normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.colors = colors;
    data.uvs = uv;
    data.applyToMesh(mesh);
    mesh.parent = this.oasis;
    mesh.material = this.mat('island-mat', '#ffffff');
    mesh.receiveShadows = true;
    return mesh;
  }
  private buildOasis() {
    this.ground();
    const water = this.attach(
      MeshBuilder.CreateDisc(
        'water-surface',
        { radius: 10.6, tessellation: 72, sideOrientation: Mesh.DOUBLESIDE },
        this.scene,
      ),
      this.oasis,
      this.mat('water', '#4ba4ab', 0.12, 0.68),
      v(0, 0.3, 0),
    );
    water.rotation.x = Math.PI / 2;
    const mouth = this.attach(
      MeshBuilder.CreateTorus(
        'shore-lip',
        { diameter: 21.1, thickness: 0.14, tessellation: 72 },
        this.scene,
      ),
      this.oasis,
      this.mat('sand', '#d7c49d'),
    );
    mouth.position.y = 0.3;
    const dome = this.attach(
      MeshBuilder.CreateSphere(
        'violet-dome',
        { diameter: 144, segments: 32, slice: 0.5, sideOrientation: Mesh.DOUBLESIDE },
        this.scene,
      ),
      this.oasis,
      this.mat('dome', '#916ac2', 0.35, 0.17),
    );
    dome.scaling.y = 0.68;
    (dome.material as StandardMaterial).disableDepthWrite = true;
    const ribs = this.mat('rib', '#c2a5e8', 0.35, 0.4);
    for (let i = 0; i < 10; i++) {
      const az = (i * Math.PI * 2) / 10,
        path: Vector3[] = [];
      for (let j = 0; j <= 32; j++) {
        const a = (j * Math.PI) / 2 / 32;
        path.push(
          new Vector3(
            Math.cos(a) * 71.8 * Math.cos(az),
            Math.sin(a) * 48.8,
            Math.cos(a) * 71.8 * Math.sin(az),
          ),
        );
      }
      this.attach(
        MeshBuilder.CreateTube(
          `dome-rib-${i}`,
          { path, radius: 0.045, tessellation: 4 },
          this.scene,
        ),
        this.oasis,
        ribs,
      );
    }
    const outer = this.mat('outer-rock', '#314c53');
    for (let i = 0; i < 19; i++) {
      const a = i * 2.399,
        m = this.attach(
          MeshBuilder.CreatePolyhedron(`outer-${i}`, { type: 1, size: 1 }, this.scene),
          this.oasis,
          outer,
          v(Math.cos(a) * (90 + i * 3), -13, Math.sin(a) * (90 + i * 3)),
        );
      m.scaling.set(15 + (i % 4) * 4, 16 + (i % 5) * 3, 17);
      m.rotation.y = a;
    }
    this.fish.position.set(28, 3.3, 10);
    this.fish.parent = this.oasis;
    const pedestal = this.attach(
      MeshBuilder.CreateCylinder(
        'workshop-plinth',
        { diameter: 7.5, height: 0.55, tessellation: 12 },
        this.scene,
      ),
      this.oasis,
      this.mat('plinth', '#9a783d'),
      v(28, 1.05, 10),
    );
    const plinthMaterial = pedestal.material as StandardMaterial;
    plinthMaterial.specularColor = Color3.Black();
    plinthMaterial.disableLighting = true;
    plinthMaterial.emissiveColor = color('#d8b96c');
    const plinthNormals = pedestal.getVerticesData('normal')!;
    const plinthColors: number[] = [];
    for (let i = 0; i < plinthNormals.length; i += 3) {
      const shade = 0.78 + Math.max(0, plinthNormals[i + 1]) * 0.22;
      plinthColors.push(shade, shade, shade, 1);
    }
    pedestal.setVerticesData('color', plinthColors);
    pedestal.receiveShadows = true;
    const ring = this.attach(
      MeshBuilder.CreateTorus(
        'workshop-ring',
        { diameter: 6.8, thickness: 0.08, tessellation: 40 },
        this.scene,
      ),
      this.oasis,
      this.mat('workshop-light', '#bde8b2', 0.6),
    );
    ring.position.set(28, 1.4, 10);
    const sign = this.label('ULEPSZENIA', '#cde8ca', 3.7, 0.8);
    sign.parent = this.oasis;
    sign.position.set(28, 6.2, 10);
    return water;
  }
  private label(text: string, hex: string, width = 3, height = 1) {
    const t = new DynamicTexture(`label-${text}`, { width: 512, height: 128 }, this.scene, true),
      ctx = t.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = hex;
    ctx.font = '600 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 81);
    t.update();
    const m = new StandardMaterial(`label-${text}`, this.scene);
    m.diffuseTexture = t;
    m.opacityTexture = t;
    m.emissiveColor = Color3.White();
    m.disableLighting = true;
    m.backFaceCulling = false;
    m.metadata = { levelLabel: true };
    const mesh = MeshBuilder.CreatePlane(`label-${text}`, { width, height }, this.scene);
    mesh.material = m;
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.isPickable = false;
    return mesh;
  }
  async load(onProgress: (text: string) => void) {
    const names = [
      ...marine.assets.map((asset) => asset.name),
      'SM_Tree_Round',
      'SM_Tree_Lime',
      'SM_Tree_Sage',
      'SM_Eco_Broadleaf',
      'SM_Eco_FanPlant',
      'SM_Eco_ShoreRock',
    ];
    await Promise.all(
      names.map(async (name) => {
        try {
          const container = await SceneLoader.LoadAssetContainerAsync(
            `${import.meta.env.BASE_URL}models/`,
            `${name}.glb?v=0.4`,
            this.scene,
          );
          if (marine.assets.some((asset) => asset.name === name)) {
            const painted = this.mat('marine-paint', '#ffffff', 0.16);
            painted.sideOrientation = Material.ClockWiseSideOrientation;
            // glTF COLOR_0 has four channels, but all these models are solid.
            // Force depth writes instead of treating their vertex alpha as glass.
            painted.transparencyMode = Material.MATERIAL_OPAQUE;
            painted.specularColor = color('#394f50');
            painted.specularPower = 40;
            const oldMaterials = new Set(container.meshes.map((mesh) => mesh.material));
            for (const mesh of container.meshes)
              if (mesh.material) {
                mesh.material = painted;
                mesh.hasVertexAlpha = false;
              }
            container.materials = [];
            for (const material of oldMaterials) material?.dispose();
          }
          this.containers.set(name, container);
        } catch {
          this.loadErrors.push(name);
        }
        onProgress(`Przygotowanie świata · ${this.containers.size}/${names.length}`);
      }),
    );
    if (!this.instantiate('submarine', this.boat))
      this.attach(
        MeshBuilder.CreateSphere('fallback-hull', { diameter: 2, segments: 12 }, this.scene),
        this.boat,
        this.mat('hull', '#c29a60'),
      ).scaling.z = 2.2;
    this.instantiate('fish', this.fish);
    this.instantiate('marine-propeller', this.propeller);
    this.fish.rotation.y = -0.9;
    for (const mesh of this.boat.getChildMeshes()) {
      this.shadow.addShadowCaster(mesh);
      mesh.isPickable = false;
    }
    const rng = seeded(81);
    for (let i = 0; i < 48; i++) {
      const az = rng() * Math.PI * 2,
        radius = 21 + rng() * 37,
        root = new TransformNode(`tree-${i}`, this.scene);
      root.parent = this.oasis;
      root.position.set(Math.cos(az) * radius, 0.5, Math.sin(az) * radius);
      root.rotation.y = rng() * Math.PI * 2;
      root.scaling.setAll(1.2 + rng() * 0.75);
      if (Math.hypot(root.position.x - 28, root.position.z - 10) < 10) {
        root.dispose();
        continue;
      }
      this.instantiate(['SM_Tree_Round', 'SM_Tree_Lime', 'SM_Tree_Sage'][i % 3], root);
      this.foliageRoots.push(root);
      for (const m of root.getChildMeshes()) this.shadow.addShadowCaster(m);
    }
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2,
        r = 15 + rng() * 42,
        root = new TransformNode(`foliage-${i}`, this.scene);
      root.parent = this.oasis;
      root.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
      root.rotation.y = rng() * 6.28;
      root.scaling.setAll(0.8 + rng() * 1.1);
      this.instantiate(
        i % 3 ? 'SM_Eco_ShoreRock' : i % 2 ? 'SM_Eco_Broadleaf' : 'SM_Eco_FanPlant',
        root,
      );
      this.foliageRoots.push(root);
    }
    this.buildLevel();
    await this.scene.whenReadyAsync();
  }
  private instantiate(name: string, parent: TransformNode) {
    const container = this.containers.get(name);
    if (!container) return false;
    const entries = container.instantiateModelsToScene((n) => `${parent.name}-${n}`, false, {
      doNotInstantiate: name === 'submarine' || name === 'fish',
    });
    for (const root of entries.rootNodes) {
      root.parent = parent;
      // glTF's handedness conversion reflects X. Keep shutter sectors aligned
      // with the gameplay's radial slide directions; creature noses stay +Z.
      if (name === 'marine-shutter' && root instanceof TransformNode)
        root.rotate(Vector3.Up(), Math.PI);
      root.setEnabled(true);
    }
    for (const m of parent.getChildMeshes()) {
      m.isPickable = false;
      if (m.material instanceof PBRMaterial) {
        m.material.metallic = name === 'submarine' ? 0.3 : 0;
        m.material.roughness = name === 'submarine' ? 0.45 : 0.95;
      }
    }
    return true;
  }
  private tube(route: Route, routes: Route[]) {
    const { path, radius } = route,
      sides = 20;
    const competing = routes.filter(
      (r) =>
        r !== route &&
        [path[0], path[path.length - 1]].some(
          (p) => dist(p, r.path[0]) < 0.2 || dist(p, r.path[r.path.length - 1]) < 0.2,
        ),
    );
    const points: { p: V3; normal: V3; uv: number[]; field: number; shade: number }[] = [];
    let right = v(1, 0, 0);
    for (let i = 0; i < path.length; i++) {
      const tangent = norm(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)]));
      right = norm(sub(right, mul(tangent, dot(right, tangent))));
      if (len(right) < 0.2) right = norm(cross(tangent, v(0, 0, 1)));
      const up = norm(cross(tangent, right));
      for (let j = 0; j <= sides; j++) {
        const a = (j * Math.PI * 2) / sides,
          radial = add(mul(right, Math.cos(a)), mul(up, Math.sin(a))),
          p = add(path[i], mul(radial, radius));
        let field = 1e6;
        for (const other of competing)
          field = Math.min(
            field,
            closestOnPath(p, other.path, other.lengths).distance - other.radius + 0.025,
          );
        points.push({
          p,
          normal: mul(radial, -1),
          uv: [(j / sides) * 4, route.lengths[i] / 7],
          field,
          shade: 0.9 - radial.y * 0.08,
        });
      }
    }
    const positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const tint = Color3.Lerp(color(this.game.level.wall), color('#fff8e8'), 0.86);
    const push = (t: typeof points) => {
      let poly = t;
      if (poly.some((p) => p.field < 0)) {
        const clipped: typeof points = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            b = poly[(i + 1) % poly.length];
          if (a.field >= 0) clipped.push(a);
          if (a.field >= 0 !== b.field >= 0) {
            const f = a.field / (a.field - b.field);
            clipped.push({
              p: mix(a.p, b.p, f),
              normal: norm(mix(a.normal, b.normal, f)),
              uv: [a.uv[0] * (1 - f) + b.uv[0] * f, a.uv[1] * (1 - f) + b.uv[1] * f],
              field: 0,
              shade: a.shade * (1 - f) + b.shade * f,
            });
          }
        }
        poly = clipped;
      }
      if (poly.length < 3) return;
      const base = positions.length / 3;
      for (const a of poly) {
        positions.push(a.p.x, a.p.y, a.p.z);
        normals.push(a.normal.x, a.normal.y, a.normal.z);
        uvs.push(...a.uv);
        colors.push(tint.r * a.shade, tint.g * a.shade, tint.b * a.shade, 1);
      }
      for (let i = 1; i < poly.length - 1; i++) indices.push(base, base + i, base + i + 1);
    };
    for (let i = 0; i < path.length - 1; i++)
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j,
          b = a + sides + 1;
        push([points[a], points[b], points[b + 1]]);
        push([points[a], points[b + 1], points[a + 1]]);
      }
    const mesh = new Mesh(`tube-${route.id}`, this.scene),
      data = new VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    data.colors = colors;
    data.applyToMesh(mesh);
    mesh.material = this.wall;
    mesh.parent = this.pipes;
    mesh.metadata = { pair: route.pair };
    mesh.isPickable = false;
    return mesh;
  }
  buildLevel() {
    this.cameraReady = false;
    this.finishGlow?.dispose();
    for (const m of new Set(this.pipes.getChildMeshes().map((m) => m.material)))
      if (m?.metadata?.levelLabel) m.dispose(true, true);
    this.pipes.dispose(false, false);
    this.pipes = new TransformNode('tunnels', this.scene);
    this.entities.clear();
    this.wall.diffuseColor = Color3.White();
    this.wall.emissiveColor = Color3.White();
    for (const route of this.game.layout.routes) this.tube(route, this.game.layout.routes);
    const rimMat = this.mat('guide-rim', this.game.level.accent, 0.1);
    rimMat.diffuseColor = color(this.game.level.accent);
    rimMat.emissiveColor = color(this.game.level.glow).scale(0.8);
    for (const sector of this.game.layout.sectors) {
      for (const side of [-1, 1]) {
        const text = side < 0 ? '01  ←' : '→  00',
          label = this.label(text, '#c9e9da', 3, 0.8);
        label.parent = this.pipes;
        label.position.copyFrom(bv(add(sector.start, v(side * 5.5, 3.8, 8))));
        label.metadata = { pair: sector.index };
      }
      const route = this.game.layout.routes.find(
        (r) => r.pair === sector.index && r.kind === 'connector',
      )!;
      this.scenery(route);
      for (let s = 14; s < route.length; s += 28) {
        const pos = along(route, s),
          tangent = norm(sub(along(route, s + 1), along(route, s - 1)));
        const ring = this.attach(
          MeshBuilder.CreateTorus(
            'pipe-band',
            { diameter: route.radius * 2 - 0.3, thickness: 0.14, tessellation: 20 },
            this.scene,
          ),
          this.pipes,
          rimMat,
          pos,
        );
        ring.rotationQuaternion = Quaternion.FromUnitVectorsToRef(
          Vector3.Up(),
          bv(tangent),
          new Quaternion(),
        );
        ring.metadata = { pair: sector.index };
      }
    }
    for (const e of this.game.entities) this.entities.set(e.id, this.entity(e));
    const finish = this.game.layout.routes.find((r) => r.kind === 'finish')!;
    const gem = this.attach(
      MeshBuilder.CreatePolyhedron('finish-diamond', { type: 1, size: 1 }, this.scene),
      this.pipes,
      this.mat('finish-emerald', '#08b52c', 0.55),
      this.game.layout.exit,
    );
    gem.scaling.set(2.5, 3.4, 2.5);
    gem.metadata = { pair: finish.pair };
    gem.isPickable = false;
    const gemMaterial = gem.material as StandardMaterial;
    gemMaterial.specularColor = color('#84ff9a').scale(0.18);
    gemMaterial.specularPower = 96;
    this.finishDiamond = gem;
    this.finishGlow = new GlowLayer('finish-diamond-glow', this.scene, {
      blurKernelSize: 64,
      mainTextureRatio: 0.5,
    });
    this.finishGlow.addIncludedOnlyMesh(gem);
    this.finishGlow.intensity = 0.9;
    this.renderedLayout = this.game.layout;
  }
  private scenery(route: Route) {
    const stage = this.game.save.level;
    const name = ['marine-rock', 'marine-kelp', 'marine-coral', 'marine-ruin', 'marine-crystal'][
      stage
    ];
    let index = 0;
    for (let distance = 22; distance < route.length - 10; distance += 30) {
      const p = along(route, distance);
      const forward = norm(sub(along(route, distance + 1), along(route, distance - 1)));
      const right = norm(cross(forward, v(0, 1, 0)));
      const up = norm(cross(right, forward));
      const side = index++ % 2 ? -1 : 1;
      const root = new TransformNode(`scenery-${route.id}-${index}`, this.scene);
      root.parent = this.pipes;
      root.position.copyFrom(
        bv(add(p, add(mul(right, side * route.radius * 0.55), mul(up, -route.radius * 0.77)))),
      );
      root.rotationQuaternion = look(forward);
      root.metadata = { pair: route.pair };
      root.scaling.setAll(stage === 2 ? 0.65 : 1);
      this.instantiate(name, root);
      for (const mesh of root.getChildMeshes()) mesh.metadata = { pair: route.pair };
    }
  }
  private entity(e: Entity) {
    const root = new TransformNode(e.id, this.scene);
    root.parent = this.pipes;
    root.position.copyFrom(bv(e.position));
    root.metadata = { pair: e.pair };
    const model =
      e.kind === 'loot'
        ? `marine-loot-${e.variant % 8}`
        : e.kind === 'power'
          ? `marine-power-${e.variant % 5}`
          : e.kind === 'meteor'
            ? `marine-meteor-${e.variant % 2}`
            : e.kind === 'gas'
              ? 'marine-vent'
              : e.kind === 'disc'
                ? 'marine-gate'
                : `marine-${e.kind}`;
    this.instantiate(model, root);
    if (e.kind === 'power') {
      // Face the incoming tunnel, including sloping and curved sections.
      // Keep the open ring and its three-dimensional upgrade visible together.
      root.rotationQuaternion = look(e.forward);
      root.scaling.setAll(1.8);
      const label = this.label(upgradeInfo[upgrades[e.variant % 5]].name, '#e4f7eb', 2.8, 0.6);
      label.parent = root;
      label.position.y = 1.55;
    }
    if (e.kind === 'disc') {
      root.rotationQuaternion = look(e.forward);
      for (let i = 0; i < 6; i++) {
        const blade = new TransformNode(`disc-blade-${i}`, this.scene);
        blade.parent = root;
        blade.rotation.z = (i * Math.PI) / 3;
        blade.metadata = { blade: i };
        this.instantiate('marine-shutter', blade);
      }
    }
    if (e.kind === 'gas') {
      // The vent sits on the floor; its gas volume stays at the collision centre.
      const route = this.game.layout.routes.find((route) => route.id === e.route);
      const vent = root.getChildren()[0];
      if (route && vent instanceof TransformNode)
        vent.position.y = -Math.sqrt(route.radius ** 2 - 4.4 ** 2) + 1.3;
      const material = this.mat('gas', '#28e51c', 0.65, 0.34);
      material.disableDepthWrite = true;
      material.disableLighting = true;
      material.emissiveColor = color('#28e51c');
      // The outer shell matches the hazard radius; inner wisps cannot hide the clear lane.
      this.attach(
        MeshBuilder.CreateSphere('gas-cloud', { diameter: e.radius * 2, segments: 20 }, this.scene),
        root,
        material,
      );
      for (let i = 0; i < 3; i++) {
        this.attach(
          MeshBuilder.CreateSphere(
            'gas-wisp',
            { diameter: e.radius * 1.15, segments: 12 },
            this.scene,
          ),
          root,
          material,
          v(Math.cos(i * 2.1) * e.radius * 0.24, Math.sin(i * 2.1) * e.radius * 0.24, 0),
        );
      }
    }
    for (const mesh of root.getChildMeshes()) mesh.isPickable = false;
    return root;
  }
  event(e: GameEvent) {
    if (e.type === 'level') this.buildLevel();
    if (e.type === 'impact' && e.position) {
      const rng = seeded(Math.floor(this.time * 1000));
      for (let i = 0; i < 10; i++) {
        let f = this.fx.find((f) => f.life <= 0);
        if (!f) {
          const mesh = MeshBuilder.CreatePolyhedron(
            'impact-fragment',
            { type: 1, size: 0.12 },
            this.scene,
          );
          mesh.material = this.mat('impact', '#d5eac7', 0.8);
          f = { mesh, life: 0, velocity: Vector3.Zero() };
          this.fx.push(f);
        }
        f.mesh.position.copyFrom(bv(e.position));
        f.life = 0.5 + rng() * 0.4;
        f.mesh.setEnabled(true);
        f.velocity.set((rng() - 0.5) * 9, (rng() - 0.5) * 9, (rng() - 0.5) * 9);
      }
    }
  }
  update(dt: number) {
    this.time += dt;
    const g = this.game,
      underwater = g.position.y < -1 && g.phase !== 'menu';
    if (this.renderedLayout !== g.layout) this.buildLevel();
    if (this.quality !== g.save.settings.quality) {
      this.quality = g.save.settings.quality;
      this.engine.setHardwareScalingLevel(
        this.quality === 'low' ? 1.5 : 1 / Math.min(1.5, devicePixelRatio || 1),
      );
      this.shadow.getShadowMap()!.refreshRate = this.quality === 'low' ? 0 : 1;
      this.scene.shadowsEnabled = this.quality !== 'low';
    }
    this.scene.fogColor = Color3.Lerp(
      color('#416b72'),
      color(g.level.water),
      underwater ? 0.45 : 0.15,
    );
    this.scene.fogMode = underwater ? Scene.FOGMODE_NONE : Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.003;
    this.scene.clearColor = underwater
      ? Color4.FromColor3(Color3.Lerp(color(g.level.water), color('#b7d6db'), 0.8))
      : new Color4(0.3, 0.46, 0.53, 1);
    this.ambient.intensity = underwater ? 1 : 0.95;
    this.ambient.groundColor = underwater
      ? new Color3(0.45, 0.6, 0.63)
      : new Color3(0.13, 0.2, 0.25);
    this.sun.intensity = underwater ? 0 : 1.8;
    this.scene.shadowsEnabled = !underwater && this.quality !== 'low';
    this.fill.intensity = underwater ? 0.8 : 0.55;
    this.oasis.setEnabled(!underwater);
    this.pipes.setEnabled(underwater);
    if (this.finishDiamond && this.finishGlow) {
      this.finishDiamond.rotation.y = this.time * 0.55;
      this.finishGlow.intensity = 0.9 + Math.sin(this.time * 2) * 0.18;
    }
    this.boat.position.copyFrom(bv(g.position));
    this.boat.rotationQuaternion = look(direction(g.yaw, g.pitch));
    this.propeller.rotation.z += dt * (3 + g.speed * 1.2);
    this.fish.position.y = 3.3 + Math.sin(this.time * 1.3) * 0.2;
    this.fill.position.copyFrom(bv(add(g.position, v(0, 2, -1))));
    if (g.phase === 'menu') {
      const a = -0.7 + Math.sin(this.time * 0.08) * 0.12;
      this.camera.position.set(Math.sin(a) * 58, 27, -Math.cos(a) * 58);
      this.camera.setTarget(new Vector3(0, 2, 5));
      this.cameraReady = false;
    } else {
      const dir = direction(g.yaw, g.pitch),
        distance = g.zoom * (1 - g.aimCharge * 0.32);
      let targetPos = add(add(g.position, mul(dir, -distance)), v(0, 1.8, 0));
      if (underwater) {
        let best = { point: g.position, distance: Infinity, radius: TUNNEL_RADIUS };
        for (const r of g.layout.routes) {
          if (Math.abs(r.pair - g.pair) > 1) continue;
          const c = closestOnPath(targetPos, r.path, r.lengths);
          if (c.distance - r.radius < best.distance - best.radius)
            best = { ...c, radius: r.radius };
        }
        if (best.distance > best.radius - 0.6)
          targetPos = add(best.point, mul(norm(sub(targetPos, best.point)), best.radius - 0.6));
      }
      this.camera.position.copyFrom(
        this.cameraReady
          ? Vector3.Lerp(this.camera.position, bv(targetPos), 1 - Math.exp(-12 * dt))
          : bv(targetPos),
      );
      this.camera.setTarget(bv(add(g.position, mul(dir, 12))));
      this.cameraReady = true;
      this.camera.fov = Math.PI / 2 - g.aimCharge * 0.2;
    }
    for (const mesh of this.pipes.getChildMeshes()) {
      const p = mesh.metadata?.pair;
      if (p !== undefined)
        mesh.setEnabled(Math.abs(p - g.pair) <= 1 && !(g.phase === 'menu' && p > 0));
    }
    for (const e of g.entities) {
      let root = this.entities.get(e.id);
      if (!root) {
        root = this.entity(e);
        this.entities.set(e.id, root);
      }
      const active = e.active && Math.abs(e.pair - g.pair) <= 1 && g.phase !== 'menu';
      root.setEnabled(active);
      if (!active) continue;
      root.position.copyFrom(bv(e.position));
      if (e.kind === 'loot') root.rotation.y += dt * 0.55;
      if (e.kind === 'power') {
        root.position.y += Math.sin(this.time * 2.2) * 0.2;
        // Preserve alignment with the tunnel instead of rotating the choice edge-on.
      }
      if (e.kind === 'eel') root.rotation.y = Math.sin(e.age * 0.7) * 0.5;
      if (e.kind === 'meteor') {
        root.rotation.x += dt * 0.6;
        root.rotation.y += dt * 0.4;
      }
      if (e.kind === 'monster') {
        root.rotationQuaternion = look(norm(sub(g.position, e.position)));
        root.position.y += Math.sin(this.time) * 0.4;
      }
      if (e.kind === 'coral')
        root.scaling.setAll(e.health === 2 ? 1 + Math.min(1, e.age / CORAL_FUSE_SECONDS) * 1.6 : 1);
      if (e.kind === 'disc') {
        const cycle = (e.age + e.variant * 0.7) % 7.2,
          open = clamp(Math.min(cycle * 2, (3.4 - cycle) * 2), 0, 1);
        for (const m of root.getChildTransformNodes(true))
          if (m.metadata?.blade !== undefined) {
            const a = ((m.metadata.blade + 0.5) * Math.PI) / 3;
            m.position.set(Math.cos(a) * open * e.radius, Math.sin(a) * open * e.radius, 0);
          }
      }
    }
    for (let i = 0; i < Math.max(this.bulletMeshes.length, g.bullets.length); i++) {
      if (!this.bulletMeshes[i]) {
        const root = new TransformNode('projectile', this.scene);
        this.instantiate('marine-projectile-enemy', root);
        this.bulletMeshes[i] = root;
      }
      const root = this.bulletMeshes[i],
        bullet = g.bullets[i];
      root.setEnabled(!!bullet);
      if (bullet) {
        root.position.copyFrom(bv(bullet.position));
        root.rotationQuaternion = look(norm(bullet.velocity));
        root.scaling.setAll(bullet.enemy ? 1 : 1.6);
      }
    }
    for (const f of this.fx) {
      if (f.life <= 0) continue;
      f.life -= dt;
      f.mesh.position.addInPlace(f.velocity.scale(dt));
      f.mesh.scaling.setAll(Math.max(0.01, f.life));
      if (f.life <= 0) f.mesh.setEnabled(false);
    }
    this.updateCargo();
  }
  private cargo: TransformNode[] = [];
  private cable?: LinesMesh;
  private updateCargo() {
    const count = Math.min(this.game.cargo.length, 14),
      dir = direction(this.game.yaw, this.game.pitch);
    for (let i = 0; i < Math.max(this.cargo.length, count); i++) {
      if (!this.cargo[i]) {
        this.cargo[i] = new TransformNode('cargo', this.scene);
        this.instantiate('marine-loot-0', this.cargo[i]);
        this.cargo[i].scaling.setAll(0.45);
      }
      const m = this.cargo[i];
      m.setEnabled(i < count && this.game.phase === 'dive');
      if (i >= count) continue;
      const p = add(
        add(this.game.position, mul(dir, -(3 + i * 0.75))),
        v(
          Math.sin(this.time * 1.8 - i * 0.6) * 0.25,
          -0.65 - Math.sin(i * 0.5 + this.time) * 0.15,
          0,
        ),
      );
      m.position.copyFrom(Vector3.Lerp(m.position, bv(p), 0.22));
    }
    const points = [
      bv(add(this.game.position, mul(dir, -2.4))),
      ...Array.from(
        { length: 14 },
        (_, i) => this.cargo[Math.min(i, count - 1)]?.position.clone() ?? bv(this.game.position),
      ),
    ];
    this.cable = MeshBuilder.CreateLines(
      'salvage-cable',
      { points, instance: this.cable, updatable: true },
      this.scene,
    );
    this.cable.color = color('#b9aa82');
    this.cable.isPickable = false;
    this.cable.setEnabled(count > 0 && this.game.phase === 'dive');
  }
  metrics() {
    return {
      fps: Math.round(this.engine.getFps()),
      drawCalls: this.engine._drawCalls.current,
      activeTriangles: this.scene
        .getActiveMeshes()
        .data.slice(0, this.scene.getActiveMeshes().length)
        .reduce((sum, m) => sum + m.getTotalIndices() / 3, 0),
      meshes: this.scene.meshes.length,
      activeMeshes: this.scene.getActiveMeshes().length,
      vertices: this.scene.getTotalVertices(),
      effects: this.fx.length,
      loadErrors: this.loadErrors,
    };
  }
  render() {
    this.engine._drawCalls.fetchNewFrame();
    this.scene.render();
  }
  resize() {
    this.engine.resize();
  }
  dispose() {
    for (const c of this.containers.values()) c.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
function along(r: Route, s: number) {
  s = clamp(s, 0, r.length);
  let i = 1;
  while (i < r.lengths.length - 1 && r.lengths[i] < s) i++;
  return mix(
    r.path[i - 1],
    r.path[i],
    (s - r.lengths[i - 1]) / Math.max(0.001, r.lengths[i] - r.lengths[i - 1]),
  );
}
