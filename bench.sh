#!/bin/bash
# Benchmark script for testing TypeScript implementation with different JS runtimes
# Usage: ./bench.sh [-n count] [runtime...]
# Example: ./bench.sh bun node deno  # test all runtimes, all cases
#          ./bench.sh -n 10 bun      # test only bun with first 10 cases
#          ./bench.sh -n 0 bun node  # test all cases (0 = all)

set -e

CASES_FILE="cases.csv"
PLAYERS_DIR="src/yt/solver/test/players"
JS_FILE="run.js"
MAX_TESTS=0  # 0 means all tests

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
RUNTIMES=()
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--count)
            MAX_TESTS="$2"
            shift 2
            ;;
        *)
            RUNTIMES+=("$1")
            shift
            ;;
    esac
done

# Default runtimes if none specified
if [ ${#RUNTIMES[@]} -eq 0 ]; then
    RUNTIMES=("bun" "node" "deno")
fi

# Check if js file exists
if [ ! -f "$JS_FILE" ]; then
    echo -e "${RED}Error: Cannot find $JS_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}JS file: $JS_FILE${NC}"
echo -e "${BLUE}Cases file: $CASES_FILE${NC}"
echo -e "${BLUE}Players dir: $PLAYERS_DIR${NC}"
if [ "$MAX_TESTS" -gt 0 ]; then
    echo -e "${BLUE}Max tests: $MAX_TESTS${NC}"
else
    echo -e "${BLUE}Max tests: all${NC}"
fi
echo ""

# Build command for each runtime
get_cmd() {
    local runtime=$1
    case $runtime in
        bun)
            echo "bun $JS_FILE"
            ;;
        node)
            echo "node $JS_FILE"
            ;;
        deno)
            echo "deno --allow-read $JS_FILE"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to run tests for a specific runtime
run_tests() {
    local runtime=$1
    local passed=0
    local failed=0
    local total=0
    local test_count=0
    local start_time=$(date +%s.%N)

    local cmd=$(get_cmd "$runtime")
    if [ -z "$cmd" ]; then
        echo -e "${RED}Unknown runtime: $runtime${NC}"
        echo "$runtime:0:0:0:0"
        return
    fi

    echo -e "${BLUE}Testing runtime: ${YELLOW}$runtime${NC}"
    echo -e "${BLUE}Command: $cmd${NC}"
    echo "----------------------------------------"

    local current_player=""
    local n_args=""
    local sig_args=""
    local expected_list=""

    process_player() {
        if [ -z "$current_player" ]; then
            return
        fi

        local player_file="$PLAYERS_DIR/$current_player"
        if [ ! -f "$player_file" ]; then
            return
        fi

        # Build args array
        local args="$player_file"
        [ -n "$n_args" ] && args="$args $n_args"
        [ -n "$sig_args" ] && args="$args $sig_args"

        # Run the command
        local output
        output=$($cmd $args 2>&1) || true

        # Check each expected result
        IFS='|' read -ra results <<< "$expected_list"
        for result in "${results[@]}"; do
            [ -z "$result" ] && continue
            local type input expected
            IFS=$'\t' read -r type input expected <<< "$result"
            total=$((total + 1))

            # Check if output contains expected result
            if echo "$output" | grep -qF "\"$input\":\"$expected\""; then
                passed=$((passed + 1))
            else
                failed=$((failed + 1))
                echo -e "${RED}FAIL${NC}: $current_player $type"
                echo "  Input: $input"
                echo "  Expected: $expected"
            fi
        done
    }

    while IFS=$'\t' read -r player type input expected || [ -n "$player" ]; do
        [ -z "$player" ] && continue

        # Check if we've reached max tests
        if [ "$MAX_TESTS" -gt 0 ] && [ "$test_count" -ge "$MAX_TESTS" ]; then
            break
        fi

        # If player changed, process previous player
        if [ "$player" != "$current_player" ]; then
            process_player
            current_player="$player"
            n_args=""
            sig_args=""
            expected_list=""
        fi

        # Add to args
        if [ "$type" = "n" ]; then
            n_args="$n_args n:$input"
        else
            sig_args="$sig_args sig:$input"
        fi
        expected_list="${expected_list}${type}	${input}	${expected}|"
        test_count=$((test_count + 1))
    done < "$CASES_FILE"

    # Process last player
    process_player

    local end_time=$(date +%s.%N)
    local duration=$(awk "BEGIN {printf \"%.3f\", $end_time - $start_time}")

    echo ""
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}Results: $passed/$total passed${NC} (${duration}s)"
    else
        echo -e "${YELLOW}Results: $passed/$total passed, $failed failed${NC} (${duration}s)"
    fi
    echo ""

    # Return results
    echo "$runtime:$passed:$failed:$total:$duration"
}

# Store results for summary
RESULTS=()

# Run tests for each runtime
for runtime in "${RUNTIMES[@]}"; do
    result=$(run_tests "$runtime" | tail -1)
    RESULTS+=("$result")
done

# Print summary
echo "========================================"
echo -e "${BLUE}SUMMARY${NC}"
echo "========================================"
printf "%-10s %8s %8s %8s %12s\n" "Runtime" "Passed" "Failed" "Total" "Time"
echo "----------------------------------------"

for result in "${RESULTS[@]}"; do
    IFS=':' read -r runtime passed failed total duration <<< "$result"
    if [ "$failed" -eq 0 ]; then
        color=$GREEN
    else
        color=$YELLOW
    fi
    printf "${color}%-10s %8s %8s %8s %10.3fs${NC}\n" "$runtime" "$passed" "$failed" "$total" "$duration"
done