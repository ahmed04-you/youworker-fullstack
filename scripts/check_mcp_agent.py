#!/usr/bin/env python3
"""
Manual smoke checks for verifying Agent + MCP tool calling end-to-end.

This script:
1. Connects to real MCP servers
2. Discovers available tools
3. Simulates agent behavior by manually calling tools
4. Tests the full flow without requiring Ollama

Usage:
    # Make sure MCP servers are running
    make run-mcp-web     # Terminal 1
    make run-mcp-semantic # Terminal 2
    make run-mcp-datetime # Terminal 3

    # Run this test script
    python scripts/check_mcp_agent.py
"""
import asyncio
import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from packages.mcp import MCPClient
from packages.agent import MCPRegistry


async def test_basic_client_connection():
    """Test 1: Basic MCP client connection and tool discovery."""
    print("\n" + "=" * 80)
    print("TEST 1: Basic MCP Client Connection")
    print("=" * 80)

    client = MCPClient(server_url="http://localhost:7001", server_id="web")

    try:
        print(f"Connecting to {client.ws_url}...")
        tools = await client.list_tools()

        print(f"✓ Connected successfully!")
        print(f"✓ Discovered {len(tools)} tools:")
        for tool in tools:
            print(f"  - {tool.name}: {tool.description}")

        return True
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        return False
    finally:
        await client.close()


async def test_tool_execution():
    """Test 2: Execute a real tool call."""
    print("\n" + "=" * 80)
    print("TEST 2: Tool Execution")
    print("=" * 80)

    client = MCPClient(server_url="http://localhost:7001", server_id="web")

    try:
        await client.list_tools()

        # Test web.search tool
        print("Calling web.search with query='Python FastAPI'...")
        result = await client.call_tool(
            "web.search", {"query": "Python FastAPI", "top_k": 3}
        )

        print(f"✓ Tool call successful!")
        print(f"Result type: {type(result)}")
        print(f"Result preview: {json.dumps(result, indent=2)[:500]}...")

        # Verify result structure
        if isinstance(result, dict) and "results" in result:
            print(f"✓ Result has expected structure with {len(result['results'])} results")
            return True
        else:
            print(f"✗ Unexpected result structure")
            return False

    except Exception as e:
        print(f"✗ Tool execution failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await client.close()


async def test_registry_discovery():
    """Test 3: Registry discovers tools from multiple servers."""
    print("\n" + "=" * 80)
    print("TEST 3: Multi-Server Registry Discovery")
    print("=" * 80)

    server_configs = [
        {"server_id": "web", "url": "http://localhost:7001"},
        {"server_id": "semantic", "url": "http://localhost:7002"},
        {"server_id": "datetime", "url": "http://localhost:7003"},
    ]

    registry = MCPRegistry(server_configs=server_configs)

    try:
        print("Connecting to all MCP servers...")
        await registry.connect_all()

        print(f"✓ Connected to {len(registry.clients)} servers")
        print(f"✓ Discovered {len(registry.tools)} total tools:")

        for tool_name, tool in registry.tools.items():
            print(f"  - {tool_name} ({tool.server_id}): {tool.description[:60]}...")

        # Test exposure mapping
        llm_tools = registry.to_llm_tools()
        print(f"\n✓ Generated {len(llm_tools)} LLM tool schemas")
        print("Exposed tool names:")
        for tool_schema in llm_tools:
            print(f"  - {tool_schema['function']['name']}")

        return True

    except Exception as e:
        print(f"✗ Registry discovery failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await registry.close_all()


async def test_registry_tool_routing():
    """Test 4: Registry correctly routes tool calls to servers."""
    print("\n" + "=" * 80)
    print("TEST 4: Registry Tool Routing")
    print("=" * 80)

    server_configs = [
        {"server_id": "web", "url": "http://localhost:7001"},
        {"server_id": "datetime", "url": "http://localhost:7003"},
    ]

    registry = MCPRegistry(server_configs=server_configs)

    try:
        await registry.connect_all()

        # Test calling with exposed name (sanitized)
        print("Testing web_search (exposed name)...")
        result1 = await registry.call_tool("web_search", {"query": "AI agents", "top_k": 2})
        print(f"✓ web_search executed: {list(result1.keys())}")

        # Test calling with qualified name
        print("\nTesting web.fetch (qualified name)...")
        result2 = await registry.call_tool(
            "web.fetch", {"url": "https://example.com", "max_links": 5}
        )
        print(f"✓ web.fetch executed: {list(result2.keys())}")

        # Test datetime tool
        print("\nTesting datetime.now (different server)...")
        result3 = await registry.call_tool("datetime.now", {"tz": "UTC"})
        print(f"✓ datetime.now executed: {result3}")

        return True

    except Exception as e:
        print(f"✗ Tool routing failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await registry.close_all()


async def test_agent_integration():
    """Test 5: Full agent integration (simulated)."""
    print("\n" + "=" * 80)
    print("TEST 5: Agent Integration (Simulated)")
    print("=" * 80)

    from packages.agent import AgentLoop
    from packages.llm import OllamaClient, ChatMessage, ToolCall

    server_configs = [
        {"server_id": "web", "url": "http://localhost:7001"},
    ]

    registry = MCPRegistry(server_configs=server_configs)
    ollama_client = OllamaClient(base_url="http://localhost:11434")  # Won't actually call
    agent_loop = AgentLoop(
        ollama_client=ollama_client,
        registry=registry,
        model="gpt-oss:20b",
    )

    try:
        await registry.connect_all()

        # Simulate a tool call (as if LLM requested it)
        print("Simulating tool call from agent...")
        simulated_tool_call = ToolCall(
            id="test_call_1",
            name="web_search",  # Exposed name
            arguments={"query": "MCP protocol", "top_k": 3},
        )

        print(f"Tool call: {simulated_tool_call.name}")
        print(f"Arguments: {simulated_tool_call.arguments}")

        # Execute through agent
        result = await agent_loop.execute_tool_call(simulated_tool_call)

        print(f"\n✓ Agent executed tool call successfully!")
        print(f"Result length: {len(result)} chars")
        print(f"Result preview:\n{result[:300]}...")

        # Verify result is valid JSON
        json.loads(result)
        print(f"✓ Result is valid JSON")

        return True

    except Exception as e:
        print(f"✗ Agent integration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await registry.close_all()
        await ollama_client.close()


async def test_error_handling():
    """Test 6: Error handling for invalid tool calls."""
    print("\n" + "=" * 80)
    print("TEST 6: Error Handling")
    print("=" * 80)

    registry = MCPRegistry(
        server_configs=[{"server_id": "web", "url": "http://localhost:7001"}]
    )

    try:
        await registry.connect_all()

        # Test 1: Invalid tool name
        print("Testing invalid tool name...")
        try:
            await registry.call_tool("nonexistent_tool", {"arg": "value"})
            print("✗ Should have raised ValueError")
            return False
        except ValueError as e:
            print(f"✓ Correctly raised ValueError: {e}")

        # Test 2: Missing required argument
        print("\nTesting missing required argument...")
        try:
            result = await registry.call_tool("web_search", {})  # Missing 'query'
            # Server should return error in result
            print(f"✓ Server returned error: {result}")
        except Exception as e:
            print(f"✓ Raised exception: {e}")

        # Test 3: Invalid argument type
        print("\nTesting invalid argument type...")
        try:
            result = await registry.call_tool("web_search", {"query": 123})  # Should be string
            print(f"✓ Server handled invalid type: {result}")
        except Exception as e:
            print(f"✓ Raised exception: {e}")

        return True

    except Exception as e:
        print(f"✗ Error handling test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await registry.close_all()


async def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("MCP AGENT INTEGRATION TEST SUITE")
    print("=" * 80)
    print("\nPrerequisites:")
    print("  1. MCP web server running on localhost:7001")
    print("  2. MCP semantic server running on localhost:7002")
    print("  3. MCP datetime server running on localhost:7003")
    print("\nStarting tests in 3 seconds...")
    await asyncio.sleep(3)

    results = {}

    # Run tests sequentially
    results["basic_connection"] = await test_basic_client_connection()
    results["tool_execution"] = await test_tool_execution()
    results["registry_discovery"] = await test_registry_discovery()
    results["registry_routing"] = await test_registry_tool_routing()
    results["agent_integration"] = await test_agent_integration()
    results["error_handling"] = await test_error_handling()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
