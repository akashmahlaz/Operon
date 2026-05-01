import { collections } from "@/lib/db-collections";
import { builtInSkills } from "@/lib/skills";
import type { Skill } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredSkill extends Document, Skill {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const skills = () => collections.skills<StoredSkill>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    skills().createIndex({ userId: 1, slug: 1 }, { unique: true }),
    skills().createIndex({ userId: 1, enabled: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

function mergeSkill(baseSkill: Skill, storedSkill?: StoredSkill): Skill {
  return storedSkill ? { ...baseSkill, ...storedSkill, id: storedSkill.id || storedSkill._id } : baseSkill;
}

export async function listSkills(userId: string) {
  await ensureIndexes();
  const storedSkills = await skills().find({ userId }).toArray();
  const bySlug = new Map(storedSkills.map((skill) => [skill.slug, skill]));
  return builtInSkills.map((skill) => mergeSkill(skill, bySlug.get(skill.slug)));
}

export async function setSkillEnabled(userId: string, slug: string, enabled: boolean) {
  await ensureIndexes();
  const baseSkill = builtInSkills.find((skill) => skill.slug === slug);
  if (!baseSkill) return null;

  const updatedAt = new Date().toISOString();
  await skills().updateOne(
    { userId, slug },
    {
      $set: {
        ...baseSkill,
        enabled,
        installed: true,
        updatedAt,
      },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        id: baseSkill.id,
        userId,
        createdAt: updatedAt,
      },
    },
    { upsert: true },
  );

  return skills().findOne({ userId, slug });
}
