#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/view.glsl

// lomo:lomo.vert

void frx_pipelineVertex() {
	if (frx_isGui) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
		frx_distance = length(gl_Position.xyz);
	} else {
		frx_vertex += frx_modelToCamera;
		vec4 viewCoord = frx_viewMatrix * frx_vertex;
		frx_distance = length(viewCoord.xyz);
		gl_Position = frx_projectionMatrix * viewCoord;
	}

	pv_diffuse = p_diffuse(frx_vertexNormal);
}