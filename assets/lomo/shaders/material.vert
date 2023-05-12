#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl

void frx_pipelineVertex() {
	if (frx_isGui) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
		frx_distance = length(gl_Position.xyz);
	} else {
		frx_vertex += frx_modelToCamera;
		vec4 view_coord = frx_viewMatrix * frx_vertex;
		frx_distance = length(view_coord.xyz);
		gl_Position = frx_projectionMatrix * view_coord;
	}
	pv_diffuse = p_diffuse(frx_vertexNormal);
}
