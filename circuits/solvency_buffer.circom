pragma circom 2.1.6;

include "node_modules/circomlib/circuits/comparators.circom";

// Solvency with 5% buffer: reserves >= liabilities * 1.05
// Implemented as: reserves * 100 >= liabilities * 105
template SolvencyBuffer() {
    // Public inputs
    signal input liabilitiesRoot;
    signal input reservesTotal;
    signal input epochId;
    
    // Private inputs
    signal input liabilitiesTotal;
    
    // Output (1 = solvent with buffer, 0 = not)
    signal output isSolvent;
    
    // Compute scaled values to avoid decimals
    // reserves * 100 >= liabilities * 105
    signal reservesScaled;
    signal liabilitiesScaled;
    
    reservesScaled <== reservesTotal * 100;
    liabilitiesScaled <== liabilitiesTotal * 105;
    
    // Constraint: reservesScaled >= liabilitiesScaled
    component gte = GreaterEqThan(252);
    gte.in[0] <== reservesScaled;
    gte.in[1] <== liabilitiesScaled;
    
    isSolvent <== gte.out;
    
    // Ensure isSolvent is 1 (proof fails if not solvent with buffer)
    isSolvent === 1;
    
    // Dummy constraints to ensure all public inputs are used
    signal dummy1;
    signal dummy2;
    dummy1 <== liabilitiesRoot * epochId;
    dummy2 <== dummy1 * 0;
}

component main {public [liabilitiesRoot, reservesTotal, epochId]} = SolvencyBuffer();
