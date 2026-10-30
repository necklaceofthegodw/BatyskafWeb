"""Read-only commandlet: evaluate the existing Blueprint pipe assembly in a temporary world."""
import unreal, pathlib, json
root = pathlib.Path(unreal.Paths.project_dir())
out = root / 'Saved/Automation/WebRewrite/crossroad-geometry.json'
def vec(v): return dict(x=v.x, y=v.y, z=v.z)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
cls = unreal.load_class(None, '/Game/Batyscaphe/PipeSystem/CrossroadPipeSystem/BP_PipeSystemManager1.BP_PipeSystemManager1_C')
report = {}
for index in range(1, 8):
    manager = actors.spawn_actor_from_class(cls, unreal.Vector(0, 0, 0))
    table = unreal.load_asset('/Game/Batyscaphe/PipeSystem/PipeSystemVariants/WorkingVariants/DT_PipeCrossroad' + str(index))
    try:
        manager.call_method('SpawnPipes', (table,))
        components = []
        for actor in [manager] + list(manager.get_editor_property('Pipes')):
            for mesh in actor.get_components_by_class(unreal.StaticMeshComponent):
                if not mesh.static_mesh: continue
                sockets = {str(name): vec(mesh.get_socket_location(name)) for name in mesh.get_all_socket_names() if str(name).startswith('Socket')}
                components.append(dict(name=actor.get_name(), mesh=mesh.static_mesh.get_path_name(), sockets=sockets, position=vec(mesh.get_world_location())))
        report[str(index)] = components
    except Exception as error:
        report[str(index)] = dict(error=str(error))
    for actor in actors.get_all_level_actors():
        if actor.get_class().get_name().startswith('BP_Pipe'):
            actors.destroy_actor(actor)
out.write_text(json.dumps(report, indent=2), encoding='utf-8')
print('WEB_CROSSROADS', str(out))

