import { isMoving } from '../domain/people';
import type { Person } from '../domain/types';
import { Sprite } from '../assets/Sprite';

const ACTIVITY_LABEL: Partial<Record<Person['activity'], string>> = {
  OBSERVING: 'observa',
  REPORTING: 'reporta',
  COLLECTING: 'recoge agua',
  INSPECTING: 'toma muestra',
  REPAIRING: 'repara',
  SYNCING: 'sincroniza',
  WAITING: 'espera',
};

export function VillagerSprite({ person, paused }: { person: Person; paused: boolean }) {
  const moving = isMoving(person) && !paused;
  return (
    <div className={`villager ${person.role === 'WORKER' ? 'worker' : ''}`} style={{ left: `${person.pos.x}%`, top: `${person.pos.y}%` }}>
      {person.bubble && <div className="bubble">{person.bubble}</div>}
      <div className={`villager-body ${moving ? 'bob' : ''}`} style={{ transform: `scaleX(${person.facing})` }}>
        <Sprite name={person.sprite} alt={person.name} className="villager-art" />
      </div>
      <span className="villager-tag">
        {person.name.split(' ')[0]}
        {ACTIVITY_LABEL[person.activity] ? ` · ${ACTIVITY_LABEL[person.activity]}` : ''}
      </span>
    </div>
  );
}
