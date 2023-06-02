#include canvas:shaders/pipeline/diffuse.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/player.glsl

//out vec3 prev_camera_space_pos;

vec2 taa_offset() {
	// 0: -0.25, -0.25
	// 1:  0.25, -0.25
	// 2: -0.25,  0.25
	// 3:  0.25,  0.25
	uint i = frx_renderFrames;
	return (
		vec2(float(i % 2u), float((i / 2u) % 2u)) - 0.5
	) * 0.5;
}

void frx_pipelineVertex() {
	if (frx_isGui && !frx_isHand) {
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
	} else {
		vec4 ndc0;

		if(!frx_isHand) {
			frx_vertex += frx_modelToCamera;

			vec4 view_coord = frx_viewMatrix * frx_vertex;

			ndc0 = frx_projectionMatrix * view_coord;
		}
		else {
			ndc0 = frx_guiViewProjectionMatrix * frx_vertex;
		}

		vec3 ndc = ndc0.xyz / ndc0.w;

		vec3 window_space_pos = (ndc.xyz * 0.5 + 0.5) * vec3(frx_viewWidth, frx_viewHeight, 1.0);

		window_space_pos.xy += taa_offset();

		ndc = window_space_pos / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		gl_Position = vec4(ndc, 1.0) * ndc0.w;
	}
}
