import type Phaser from 'phaser';

export type CharacterArtKey = 'player' | 'scout' | 'bandit' | 'wuzhen' | 'villager';

export type CharacterArtSpec = {
  textureKey: string;
  width: number;
  height: number;
  transparentBackground: true;
  features: string[];
};

export const CHARACTER_ART_SPECS: Record<CharacterArtKey, CharacterArtSpec> = {
  player: {
    textureKey: 'player',
    width: 64,
    height: 88,
    transparentBackground: true,
    features: ['black hair', 'cyan inner robe', 'dark short coat', 'dragon blade'],
  },
  scout: {
    textureKey: 'enemy-scout',
    width: 58,
    height: 82,
    transparentBackground: true,
    features: ['black hood', 'red eye line', 'scale sash', 'short dagger'],
  },
  bandit: {
    textureKey: 'enemy-bandit',
    width: 66,
    height: 86,
    transparentBackground: true,
    features: ['brown torn coat', 'wide shoulders', 'cloth belt', 'heavy blade'],
  },
  wuzhen: {
    textureKey: 'boss-wuzhen',
    width: 78,
    height: 104,
    transparentBackground: true,
    features: ['tall assassin frame', 'red-black cloak', 'needle blades', 'evil aura'],
  },
  villager: {
    textureKey: 'npc-villager',
    width: 60,
    height: 84,
    transparentBackground: true,
    features: ['grey robe', 'straw hat', 'hunched frame', 'rain-soaked'],
  },
};

const drawPixelRect = (
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha = 1,
) => {
  gfx.fillStyle(color, alpha);
  gfx.fillRect(x, y, width, height);
};

const drawBlade = (
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  length: number,
  direction: 1 | -1,
  color: number,
) => {
  gfx.lineStyle(4, 0x0b0d12, 0.9);
  gfx.lineBetween(x, y, x + direction * length, y - 22);
  gfx.lineStyle(2, color, 1);
  gfx.lineBetween(x, y - 1, x + direction * length, y - 23);
  gfx.lineStyle(1, 0xffffff, 0.75);
  gfx.lineBetween(x + direction * 8, y - 3, x + direction * (length - 8), y - 21);
};

export const createCharacterTextures = (scene: Phaser.Scene) => {
  createPlayerTexture(scene);
  createScoutTexture(scene);
  createBanditTexture(scene);
  createWuzhenTexture(scene);
  createVillagerTexture(scene);
};

const makeGraphics = (scene: Phaser.Scene) => scene.make.graphics({ x: 0, y: 0 }, false);

const createPlayerTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.player;
  const gfx = makeGraphics(scene);

  drawBlade(gfx, 24, 66, 45, 1, 0xaefaff);
  drawPixelRect(gfx, 19, 20, 26, 8, 0x090a0c);
  drawPixelRect(gfx, 23, 15, 18, 14, 0x15100d);
  drawPixelRect(gfx, 25, 28, 14, 9, 0xd5b08b);
  drawPixelRect(gfx, 21, 38, 22, 26, 0xaedfe8);
  drawPixelRect(gfx, 17, 42, 12, 32, 0x202530);
  drawPixelRect(gfx, 36, 42, 12, 32, 0x202530);
  drawPixelRect(gfx, 22, 64, 8, 16, 0x121821);
  drawPixelRect(gfx, 35, 64, 8, 16, 0x121821);
  drawPixelRect(gfx, 20, 80, 11, 4, 0x0b0d12);
  drawPixelRect(gfx, 34, 80, 11, 4, 0x0b0d12);
  drawPixelRect(gfx, 18, 48, 28, 6, 0x11141a);
  drawPixelRect(gfx, 43, 50, 5, 20, 0x2b1c12);
  drawPixelRect(gfx, 47, 48, 4, 8, 0x8fefff);
  drawPixelRect(gfx, 29, 39, 7, 32, 0xeff7ec, 0.65);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};

const createScoutTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.scout;
  const gfx = makeGraphics(scene);

  drawPixelRect(gfx, 18, 18, 23, 17, 0x08090d);
  drawPixelRect(gfx, 20, 24, 19, 9, 0x16171d);
  drawPixelRect(gfx, 22, 29, 13, 4, 0xc43b3f);
  drawPixelRect(gfx, 18, 36, 23, 30, 0x11131a);
  drawPixelRect(gfx, 14, 40, 10, 27, 0x08090d);
  drawPixelRect(gfx, 36, 40, 10, 27, 0x08090d);
  drawPixelRect(gfx, 20, 51, 21, 5, 0x292117);
  drawPixelRect(gfx, 22, 64, 8, 14, 0x0a0b10);
  drawPixelRect(gfx, 33, 64, 8, 14, 0x0a0b10);
  drawPixelRect(gfx, 17, 78, 12, 4, 0x050608);
  drawPixelRect(gfx, 33, 78, 12, 4, 0x050608);
  drawBlade(gfx, 43, 55, 24, 1, 0xcccccc);
  drawPixelRect(gfx, 20, 42, 4, 4, 0x2f3541);
  drawPixelRect(gfx, 34, 46, 4, 4, 0x2f3541);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};

const createBanditTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.bandit;
  const gfx = makeGraphics(scene);

  drawBlade(gfx, 44, 45, 38, 1, 0xd0c1a0);
  drawPixelRect(gfx, 21, 18, 24, 12, 0x17100c);
  drawPixelRect(gfx, 23, 27, 18, 11, 0xb27d52);
  drawPixelRect(gfx, 14, 39, 38, 31, 0x5a3623);
  drawPixelRect(gfx, 10, 43, 13, 27, 0x3c241a);
  drawPixelRect(gfx, 45, 43, 13, 27, 0x3c241a);
  drawPixelRect(gfx, 16, 55, 35, 6, 0xb99652);
  drawPixelRect(gfx, 23, 70, 9, 13, 0x221711);
  drawPixelRect(gfx, 36, 70, 9, 13, 0x221711);
  drawPixelRect(gfx, 18, 82, 14, 4, 0x0c0b0a);
  drawPixelRect(gfx, 35, 82, 14, 4, 0x0c0b0a);
  drawPixelRect(gfx, 13, 39, 39, 5, 0x815133);
  drawPixelRect(gfx, 29, 27, 4, 42, 0x2a1710, 0.8);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};

const createWuzhenTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.wuzhen;
  const gfx = makeGraphics(scene);

  drawPixelRect(gfx, 20, 28, 38, 57, 0x2a0710, 0.44);
  drawPixelRect(gfx, 27, 15, 25, 15, 0x09090d);
  drawPixelRect(gfx, 30, 27, 18, 11, 0xc99a83);
  drawPixelRect(gfx, 24, 40, 31, 39, 0x151016);
  drawPixelRect(gfx, 18, 43, 13, 44, 0x3d0711);
  drawPixelRect(gfx, 49, 43, 13, 44, 0x3d0711);
  drawPixelRect(gfx, 26, 53, 28, 6, 0x690c18);
  drawPixelRect(gfx, 31, 79, 8, 18, 0x08090d);
  drawPixelRect(gfx, 43, 79, 8, 18, 0x08090d);
  drawPixelRect(gfx, 25, 97, 15, 4, 0x050608);
  drawPixelRect(gfx, 42, 97, 15, 4, 0x050608);
  drawBlade(gfx, 54, 54, 36, 1, 0xff9aa4);
  drawBlade(gfx, 24, 58, 30, -1, 0xff9aa4);
  drawPixelRect(gfx, 31, 32, 17, 3, 0xff304c);
  drawPixelRect(gfx, 21, 35, 5, 44, 0x7f1021, 0.72);
  drawPixelRect(gfx, 55, 35, 5, 44, 0x7f1021, 0.72);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};

const createVillagerTexture = (scene: Phaser.Scene) => {
  const spec = CHARACTER_ART_SPECS.villager;
  const gfx = makeGraphics(scene);

  // 斗笠
  drawPixelRect(gfx, 14, 14, 32, 6, 0x8a7a5a);
  drawPixelRect(gfx, 18, 10, 24, 8, 0x6b5d44);
  // 脸
  drawPixelRect(gfx, 22, 24, 16, 10, 0xc9a884);
  // 灰色长袍
  drawPixelRect(gfx, 16, 36, 28, 34, 0x5a5550);
  drawPixelRect(gfx, 12, 40, 10, 30, 0x3e3a36);
  drawPixelRect(gfx, 38, 40, 10, 30, 0x3e3a36);
  // 腰带
  drawPixelRect(gfx, 16, 54, 28, 5, 0x4a4540);
  // 腿
  drawPixelRect(gfx, 22, 70, 8, 12, 0x2a2622);
  drawPixelRect(gfx, 32, 70, 8, 12, 0x2a2622);
  drawPixelRect(gfx, 18, 82, 12, 2, 0x0c0b0a);
  drawPixelRect(gfx, 32, 82, 12, 2, 0x0c0b0a);
  // 雨湿质感（肩部高光）
  drawPixelRect(gfx, 16, 36, 28, 3, 0x7a7570, 0.5);

  gfx.generateTexture(spec.textureKey, spec.width, spec.height);
  gfx.destroy();
};
