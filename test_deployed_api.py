#!/usr/bin/env python3
"""
Comprehensive API Test Script for SolvencyProof Backend
Tests all endpoints on the deployed Railway server
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "https://solvency-proof-production.up.railway.app"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def log_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def log_info(msg):
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def log_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def log_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")

results = {
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "tests": []
}

def test_endpoint(name, method, endpoint, data=None, expected_status=200, check_fields=None):
    """Test an API endpoint and record results"""
    url = f"{BASE_URL}{endpoint}"
    start_time = time.time()
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=60)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=30)
        else:
            log_error(f"Unknown method: {method}")
            return None
        
        elapsed = time.time() - start_time
        
        result = {
            "name": name,
            "endpoint": endpoint,
            "method": method,
            "status_code": response.status_code,
            "elapsed_ms": round(elapsed * 1000, 2),
            "success": response.status_code == expected_status
        }
        
        try:
            result["response"] = response.json()
        except:
            result["response"] = response.text[:500]
        
        if response.status_code == expected_status:
            log_success(f"{name} - {response.status_code} ({elapsed*1000:.0f}ms)")
            results["passed"] += 1
            
            # Check for expected fields
            if check_fields and isinstance(result["response"], dict):
                missing = [f for f in check_fields if f not in result["response"]]
                if missing:
                    log_warning(f"  Missing expected fields: {missing}")
                    results["warnings"] += 1
        else:
            log_error(f"{name} - Expected {expected_status}, got {response.status_code}")
            results["failed"] += 1
            if result["response"]:
                print(f"    Response: {json.dumps(result['response'], indent=2)[:200]}")
        
        results["tests"].append(result)
        return result
        
    except requests.exceptions.Timeout:
        log_error(f"{name} - TIMEOUT after 30s")
        results["failed"] += 1
        results["tests"].append({"name": name, "error": "timeout"})
        return None
    except Exception as e:
        log_error(f"{name} - ERROR: {str(e)}")
        results["failed"] += 1
        results["tests"].append({"name": name, "error": str(e)})
        return None


def main():
    print(f"\n{Colors.BOLD}SolvencyProof API Test Suite{Colors.RESET}")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # ==========================================
    # 1. Health Check
    # ==========================================
    log_header("1. HEALTH CHECK")
    test_endpoint("Health Check", "GET", "/health", check_fields=["status", "timestamp"])
    
    # ==========================================
    # 2. Liabilities Endpoints
    # ==========================================
    log_header("2. LIABILITIES ENDPOINTS")
    
    test_endpoint("Get Liabilities", "GET", "/api/liabilities", 
                  check_fields=["liabilities", "count", "totalLiabilities"])
    
    test_endpoint("Build Merkle Tree", "POST", "/api/liabilities/build",
                  check_fields=["success", "merkleRoot", "totalLiabilities"])
    
    # Test verify with a known user ID
    test_endpoint("Verify Inclusion (alice)", "GET", "/api/liabilities/verify/alice")
    test_endpoint("Verify Inclusion (unknown)", "GET", "/api/liabilities/verify/unknown_user_xyz", 
                  expected_status=404)
    
    # ==========================================
    # 3. Reserves Endpoints
    # ==========================================
    log_header("3. RESERVES ENDPOINTS")
    
    test_endpoint("Get Reserves", "GET", "/api/reserves",
                  check_fields=["reserves", "totalReserves"])
    
    test_endpoint("Scan Reserves", "POST", "/api/reserves/scan",
                  check_fields=["success", "reserves"])
    
    # ==========================================
    # 4. Proof Endpoints
    # ==========================================
    log_header("4. PROOF ENDPOINTS")
    
    test_endpoint("Get Proof Data", "GET", "/api/proof")
    
    log_info("Testing proof generation (may take time)...")
    proof_result = test_endpoint("Generate ZK Proof", "POST", "/api/proof/generate",
                                  expected_status=200)
    
    # ==========================================
    # 5. Contracts Endpoints
    # ==========================================
    log_header("5. CONTRACTS ENDPOINTS")
    
    test_endpoint("Get Contract Addresses", "GET", "/api/contracts",
                  check_fields=["verifierAddress", "registryAddress"])
    
    test_endpoint("Get Epoch Count", "GET", "/api/contracts/epoch-count")
    
    test_endpoint("Get On-Chain Proof (epoch 1)", "GET", "/api/contracts/proof/1")
    
    # ==========================================
    # 6. Yellow Network Endpoints
    # ==========================================
    log_header("6. YELLOW NETWORK ENDPOINTS")
    
    test_endpoint("Get Yellow Status", "GET", "/api/yellow/status",
                  check_fields=["connected", "authenticated", "sessionsCount"])
    
    test_endpoint("List Yellow Sessions", "GET", "/api/yellow/sessions")
    
    # Create a test session
    session_result = test_endpoint("Create Yellow Session", "POST", "/api/yellow/session",
                                    data={"participants": ["0x1234567890123456789012345678901234567890"]})
    
    if session_result and session_result.get("success") and session_result.get("response", {}).get("session"):
        session_id = session_result["response"]["session"].get("id")
        if session_id:
            log_info(f"Created session: {session_id}")
            
            test_endpoint("Get Session Details", "GET", f"/api/yellow/session/{session_id}")
            
            test_endpoint("Update Allocations", "PUT", f"/api/yellow/session/{session_id}/allocations",
                         data={"allocations": {"user1": "1000", "user2": "2000"}})
            
            test_endpoint("Get Session History", "GET", f"/api/yellow/session/{session_id}/history")
    
    # ==========================================
    # 7. Workflow Endpoint
    # ==========================================
    log_header("7. FULL WORKFLOW TEST")
    
    log_info("Testing full workflow (this may take a while)...")
    workflow_result = test_endpoint("Full Workflow", "POST", "/api/workflow/full",
                                     data={"skipProof": True},  # Skip ZK proof for speed
                                     expected_status=200)
    
    # ==========================================
    # Summary
    # ==========================================
    log_header("TEST SUMMARY")
    
    total = results["passed"] + results["failed"]
    pass_rate = (results["passed"] / total * 100) if total > 0 else 0
    
    print(f"\n{Colors.BOLD}Results:{Colors.RESET}")
    print(f"  {Colors.GREEN}Passed: {results['passed']}{Colors.RESET}")
    print(f"  {Colors.RED}Failed: {results['failed']}{Colors.RESET}")
    print(f"  {Colors.YELLOW}Warnings: {results['warnings']}{Colors.RESET}")
    print(f"  Pass Rate: {pass_rate:.1f}%")
    
    # Response time analysis
    response_times = [t.get("elapsed_ms", 0) for t in results["tests"] if t.get("elapsed_ms")]
    if response_times:
        print(f"\n{Colors.BOLD}Performance:{Colors.RESET}")
        print(f"  Avg Response Time: {sum(response_times)/len(response_times):.0f}ms")
        print(f"  Max Response Time: {max(response_times):.0f}ms")
        print(f"  Min Response Time: {min(response_times):.0f}ms")
    
    # Save detailed results
    with open("test_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    log_info("Detailed results saved to test_results.json")
    
    # HackMoney readiness assessment
    log_header("HACKMONEY READINESS ASSESSMENT")
    
    critical_tests = ["Health Check", "Get Liabilities", "Build Merkle Tree", 
                      "Get Reserves", "Get Contract Addresses"]
    critical_passed = sum(1 for t in results["tests"] 
                         if t.get("name") in critical_tests and t.get("success"))
    
    print(f"\n{Colors.BOLD}Critical Endpoints:{Colors.RESET} {critical_passed}/{len(critical_tests)} working")
    
    if pass_rate >= 80 and critical_passed == len(critical_tests):
        print(f"\n{Colors.GREEN}{Colors.BOLD}✓ SYSTEM IS READY FOR HACKMONEY!{Colors.RESET}")
        print("  - All critical endpoints working")
        print("  - API is responsive and deployed")
        print("  - Core solvency proof functionality operational")
    elif pass_rate >= 60:
        print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ SYSTEM NEEDS MINOR FIXES{Colors.RESET}")
        print("  - Some endpoints may need attention")
        print("  - Review failed tests above")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}✗ SYSTEM NEEDS WORK{Colors.RESET}")
        print("  - Multiple endpoints failing")
        print("  - Review and fix issues before demo")
    
    return results


if __name__ == "__main__":
    main()
