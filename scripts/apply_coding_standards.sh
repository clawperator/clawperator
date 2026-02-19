#!/bin/bash

# Help text
show_help() {
    echo "Usage: apply_coding_standards.sh [options]"
    echo ""
    echo "Options:"
    echo "  -a, --all         Run on entire project (default: only changed files)"
    echo "  -f, --fix         Fix issues automatically where possible"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./apply_coding_standards.sh        # Check only changed files"
    echo "  ./apply_coding_standards.sh -f     # Fix issues in changed files"
    echo "  ./apply_coding_standards.sh -a     # Check entire project"
    echo "  ./apply_coding_standards.sh -af    # Fix issues in entire project"
}

# Default values
CHECK_ALL=false
FIX_ISSUES=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        -a|--all) CHECK_ALL=true ;;
        -f|--fix) FIX_ISSUES=true ;;
        -h|--help) show_help; exit 0 ;;
        *) echo "Unknown parameter: $1"; show_help; exit 1 ;;
    esac
    shift
done

# Function to get changed Kotlin files
get_changed_kotlin_files() {
    # Get both staged and unstaged files
    git diff --name-only --cached --diff-filter=ACMR | grep "\.kt$" || true
    git diff --name-only --diff-filter=ACMR | grep "\.kt$" || true
}

# Function to run tools on specific files
run_on_files() {
    local files=$1
    local fix=$2
    
    if [ -z "$files" ]; then
        echo "No Kotlin files to check."
        return 0
    fi
    
    echo "Changed files:"
    echo "$files"
    echo ""
    
    # For changed files, we'll run the tools on the whole project
    # since ktlint and detekt don't have easy file filtering in this setup
    if [ "$fix" = true ]; then
        echo "Running code formatting on project (will fix changed files)..."
        pushd apps/android > /dev/null
        ./gradlew spotlessApply
        popd > /dev/null
    else
        echo "Running code quality checks on project..."
        pushd apps/android > /dev/null
        ./gradlew ktlintCheck detekt spotlessCheck
        popd > /dev/null
    fi
}

# Function to run tools on entire project
run_on_all() {
    local fix=$1
    
    if [ "$fix" = true ]; then
        echo "Running code quality fixes on entire project..."
        pushd apps/android > /dev/null
        ./gradlew codeFormat
        popd > /dev/null
    else
        echo "Running code quality checks on entire project..."
        pushd apps/android > /dev/null
        ./gradlew codeQualityCheck
        popd > /dev/null
    fi
}

# Main execution
if [ "$CHECK_ALL" = true ]; then
    run_on_all "$FIX_ISSUES"
else
    changed_files=$(get_changed_kotlin_files)
    run_on_files "$changed_files" "$FIX_ISSUES"
fi

# Final status message
if [ $? -eq 0 ]; then
    echo "✅ Code quality checks completed successfully!"
else
    echo "❌ Code quality checks failed. Please fix the issues above."
    exit 1
fi 