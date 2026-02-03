pragma circom 2.1.6;

include "node_modules/circomlib/circuits/comparators.circom";

template Solvency() {
    // Public inputs
    signal input liabilitiesRoot;
    signal input reservesTotal;
    signal input epochId;
    
    // Private inputs
    signal input liabilitiesTotal;
    
    // Output (1 = solvent, 0 = not solvent)
    signal output isSolvent;
    
    // Constraint: reservesTotal >= liabilitiesTotal
    component gte = GreaterEqThan(252);
    gte.in[0] <== reservesTotal;
    gte.in[1] <== liabilitiesTotal;
    
    isSolvent <== gte.out;
    
    // Ensure isSolvent is 1 (proof fails if not solvent)
    isSolvent === 1;
    
    // Dummy constraints to ensure all public inputs are used
    signal dummy1;
    signal dummy2;
    dummy1 <== liabilitiesRoot * epochId;
    dummy2 <== dummy1 * 0;
}

component main {public [liabilitiesRoot, reservesTotal, epochId]} = Solvency();
