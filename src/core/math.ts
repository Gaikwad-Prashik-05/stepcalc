import {
  addDependencies,
  bignumberDependencies,
  create,
  divideDependencies,
  evaluateDependencies,
  multiplyDependencies,
  powDependencies,
  subtractDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
} from 'mathjs';

// Only what Basic mode needs; Scientific/Units add their dependencies here later.
export const math = create(
  {
    evaluateDependencies,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    powDependencies,
    unaryMinusDependencies,
    unaryPlusDependencies,
    bignumberDependencies,
  },
  { number: 'BigNumber', precision: 64 },
);
